"""Configure the pinned engine through native setup/login/API, without DB writes."""
import sys,json,subprocess,urllib.request,urllib.parse,http.client,http.cookiejar,socket,time,pathlib,re
from html.parser import HTMLParser
s=sys.stdin.buffer;line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':line=s.readline()
if line!=b'AIA_PRIVATE_INPUT_V1\n':raise SystemExit('Private framing failed')
p=json.load(s)
if p.get('mode')!='bootstrap-approved-engine':raise SystemExit('Approved engine bootstrap mode required')
c=json.loads(subprocess.check_output(['docker','inspect','aia-media-gokapi']))[0]
if any(c['NetworkSettings']['Ports'].values()):raise SystemExit('Engine unexpectedly publishes a port')
ip=next(iter(c['NetworkSettings']['Networks'].values()))['IPAddress']
base='http://gokapi:53842'
class Connection(http.client.HTTPConnection):
 def connect(self):
  if self.host!='gokapi' or self.port!=53842:raise ValueError('Engine request escaped private origin')
  self.sock=socket.create_connection((ip,53842),timeout=self.timeout)
class Handler(urllib.request.HTTPHandler):
 def http_open(self,req):return self.do_open(Connection,req)
jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(Handler(),urllib.request.HTTPCookieProcessor(jar),urllib.request.ProxyHandler({}))
class Fields(HTMLParser):
 def __init__(self):super().__init__();self.values={};self.select=None;self.option=None;self.forms=[];self.current=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='form':self.current={}
  if tag=='input' and a.get('name') and (a.get('type')!='checkbox' or 'checked' in a):
   self.values[a['name']]=a.get('value','')
   if self.current is not None:self.current[a['name']]=a.get('value','')
  if tag=='select':self.select=a.get('name')
  if tag=='option' and self.select and (self.select not in self.values or 'selected' in a):self.values[self.select]=a.get('value','')
 def handle_endtag(self,tag):
  if tag=='select':self.select=None
  if tag=='form' and self.current is not None:self.forms.append(self.current);self.current=None
def get(route):return client.open(base+route,timeout=20)
for attempt in range(60):
 try:setup=get('/setup/start').read().decode();break
 except Exception:time.sleep(1)
else:raise SystemExit('Engine setup did not become available')
fields=Fields();fields.feed(setup)
if 'dbtype_sel' not in fields.values:raise SystemExit('Engine is already configured or setup contract changed')
v=fields.values
v.update({'dbtype_sel':'0','sqlite_location':'./data/gokapi.sqlite','auth_username':p['username'],'auth_pw':p['password'],'auth_pw2':p['password'],'authentication_sel':'0','public_name':'AIA Transfer storage','url':base+'/','url_redirection':base+'/login','ssl_sel':'0','logip_sel':'0','showfilename_sel':'0','port':'53842','storage_sel':'local','storage_sel_image':'local','encrypt_sel':'1','enc_pw':''})
result=json.load(client.open(urllib.request.Request(base+'/setup/setupResult',data=json.dumps([{'name':k,'value':v} for k,v in v.items()]).encode(),headers={'Content-Type':'application/json','Origin':base}),timeout=30))
if result.get('result')!='OK':raise SystemExit('Native engine setup rejected configuration')
for attempt in range(60):
 try:
  login=get('/login').read().decode();f=Fields();f.feed(login)
  if 'csrf-token' in f.values:break
 except Exception:pass
 time.sleep(1)
else:raise SystemExit('Engine login did not become available')
login_values={**f.values,'username':p['username'],'password':p['password']}
client.open(urllib.request.Request(base+'/login',data=urllib.parse.urlencode(login_values).encode(),headers={'Origin':base}),timeout=20).read()
admin=get('/admin').read().decode()
if not any(cookie.name for cookie in jar):raise SystemExit('Native engine login failed')
permission=json.load(client.open(urllib.request.Request(base+'/auth/token',data=b'{}',headers={'permission':'PERM_API_MOD','Content-Type':'application/json','Origin':base}),timeout=20))
key=json.load(client.open(urllib.request.Request(base+'/api/auth/create',data=b'',headers={'apikey':permission['key'],'basicPermissions':'true','Origin':base}),timeout=20))['Id']
version=json.load(client.open(urllib.request.Request(base+'/api/info/version',headers={'apikey':key}),timeout=20))
if version.get('Version')!='2.2.4':raise SystemExit('Engine version drift')
env=pathlib.Path('/volume1/docker/aia-media-ecosystem/.private/app.env')
lines=[line for line in env.read_text().splitlines() if not line.startswith('AIA_GOKAPI_KEY=')]
env.write_text('\n'.join(lines+['AIA_GOKAPI_KEY='+key])+'\n');env.chmod(0o600)
print(json.dumps({'configured':True,'version':version['Version'],'nativeLoginAndApiVerified':True,'localEncryptionLevel':1,'enginePortsPublished':False,'apiKey':key}))
