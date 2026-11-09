"""Isolated recovery verification. Credentials arrive on framed SSH stdin only."""
import sys,json,subprocess,urllib.request,urllib.parse,urllib.error,http.cookiejar,hashlib,http.client,socket,re
from html.parser import HTMLParser

stream=sys.stdin.buffer
line=stream.readline()
if line != b'AIA_PRIVATE_INPUT_V1\n': line=stream.readline()
if line != b'AIA_PRIVATE_INPUT_V1\n': raise SystemExit('Private verification framing failed')
credentials=json.loads(stream.read(20000))
container=json.loads(subprocess.check_output(['docker','inspect','aia-media-p0-restore-web']))[0]
ip=next(iter(container['NetworkSettings']['Networks'].values()))['IPAddress']
base='http://'+ip
report={'checkedAt':None,'isolatedRestore':True,'productionRequestsMade':False}

def request(fn,params=None,key=None,authmode=None):
    query=urllib.parse.urlencode({'user':'DEV','function':fn,**(params or {})})
    signing=key or credentials['apiKey']
    sign=hashlib.sha256((signing+query).encode()).hexdigest()
    body={'query':query+'&sign='+sign,'sign':sign,'user':'DEV'}
    if authmode: body['authmode']=authmode
    response=urllib.request.urlopen(urllib.request.Request(base+'/api/',data=urllib.parse.urlencode(body).encode()),timeout=15)
    return json.load(response)

status=request('get_system_status')
report['signedApiAuthenticated']=status.get('status')=='OK'
report['resourceSpaceVersion']=status.get('results',{}).get('version',{}).get('info')
search=request('do_search',{'search':'','archive':'0','fetchrows':'0,1'})
report['liveResourceCount']=search.get('total')
report['boundedSearchRows']=len(search.get('data',[]))
collections=request('get_user_collections')
report['collectionBrowseVerified']=isinstance(collections,list)

allowed_hosts={'127.0.0.1',ip,'localhost'}
def remap(url):
    parts=urllib.parse.urlsplit(url)
    if parts.hostname not in allowed_hosts: raise ValueError('Recovery URL escaped isolated target')
    return base+urllib.parse.urlunsplit(('', '', parts.path or '/', parts.query, ''))

class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return super().redirect_request(req,fp,code,msg,headers,remap(newurl))

jar=http.cookiejar.CookieJar()
web_base='http://127.0.0.1:18088'
class IsolatedConnection(http.client.HTTPConnection):
    def connect(self):
        if self.host!='127.0.0.1' or self.port!=18088: raise ValueError('Web verification escaped isolated origin')
        self.sock=socket.create_connection((ip,80),timeout=self.timeout)
class IsolatedHttp(urllib.request.HTTPHandler):
    def http_open(self,req): return self.do_open(IsolatedConnection,req)
class WebRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        parsed=urllib.parse.urlsplit(newurl)
        if parsed.hostname not in allowed_hosts: raise ValueError('Web redirect escaped isolated target')
        target=web_base+urllib.parse.urlunsplit(('','',parsed.path,parsed.query,''))
        return super().redirect_request(req,fp,code,msg,headers,target)
opener=urllib.request.build_opener(IsolatedHttp(),WebRedirect(),urllib.request.HTTPCookieProcessor(jar),urllib.request.ProxyHandler({}))
guest_opener=urllib.request.build_opener(IsolatedHttp(),WebRedirect(),urllib.request.ProxyHandler({}))
guest_page=guest_opener.open(web_base+'/pages/search.php',timeout=15)
guest_html=guest_page.read().decode()
report['guestSearchDenied']=urllib.parse.urlsplit(guest_page.url).path=='/login.php' or 'name="password"' in guest_html
login_html=opener.open(web_base+'/login.php',timeout=10).read().decode()
class Form(HTMLParser):
    def __init__(self): super().__init__(); self.forms=[]; self.current=None
    def handle_starttag(self,tag,attrs):
        data=dict(attrs)
        if tag=='form': self.current={}
        if tag=='input' and data.get('name') and self.current is not None and data.get('type')!='checkbox':
            self.current[data['name']]=data.get('value','')
    def handle_endtag(self,tag):
        if tag=='form' and self.current is not None: self.forms.append(self.current); self.current=None
form=Form(); form.feed(login_html)
values=next(value for value in form.forms if 'username' in value and 'password' in value)
values.pop('langupdate',None)
values.update({'username':'DEV','password':credentials['password'],'url':web_base+'/pages/search.php','modal':''})
try:
    web_login=opener.open(urllib.request.Request(web_base+'/login.php',data=urllib.parse.urlencode(values).encode()),timeout=15)
    html=web_login.read().decode()
    # ResourceSpace 11.0 emits a JSON-encoded JS location assignment after login.
    # Follow that observed same-origin URL; do not execute arbitrary page scripts.
    redirect_match=re.search(r'window\.location\.href\s*=\s*("(?:\\.|[^"\\])*")\s*;',html)
    if redirect_match:
        parsed=urllib.parse.urlsplit(json.loads(redirect_match.group(1)))
        if parsed.hostname not in allowed_hosts: raise ValueError('Login redirect escaped recovery target')
        target=web_base+urllib.parse.urlunsplit(('','',parsed.path,parsed.query,''))
        web_login=opener.open(target,timeout=15)
        html=web_login.read().decode()
    report['webLoginFinalPath']=urllib.parse.urlsplit(web_login.url).path
    report['webLoginQueryKeys']=list(urllib.parse.parse_qs(urllib.parse.urlsplit(web_login.url).query))
    report['webLoginHasLogoutControl']='logout' in html.lower()
    report['webLoginStillHasPasswordField']='name="password"' in html.lower()
    report['webLoginVerified']=report['guestSearchDenied'] and report['webLoginFinalPath']=='/pages/search.php' and not report['webLoginStillHasPasswordField']
    report['cookieAttributes']=[{'name':c.name,'domain':c.domain,'path':c.path,'secure':c.secure} for c in jar]
    report['webLoginShowsLockout']='too many' in html.lower() or 'locked' in html.lower()
    report['webLoginShowsInvalidCredentials']='incorrect' in html.lower() or 'invalid' in html.lower()
except Exception:
    report['webLoginVerified']=False

manifest_path='/volume1/docker/aia-media-backups/'+credentials['backupId']+'/isolated-restore/filestore.sha256'
expected_hashes={line.split(' ',1)[0] for line in open(manifest_path)}
row=search['data'][0]
ref=str(row['ref'])
extension=row.get('file_extension') or 'jpg'
for label,size in [('original',''),('thumbnail','thm')]:
    requested_extension=extension if label=='original' else (row.get('preview_extension') or 'jpg')
    url=request('get_resource_path',{'ref':ref,'size':size,'extension':requested_extension,'generate':'0','write_metadata':'0'})
    if not isinstance(url,str):
        report[label+'DownloadVerified']=False
        continue
    with urllib.request.urlopen(remap(url),timeout=15) as response:
        data=response.read(50*1024*1024)
        digest=hashlib.sha256(data).hexdigest()
        report[label+'ContentType']=response.headers.get_content_type()
        report[label+'DownloadVerified']=response.status==200 and bool(data) and digest in expected_hashes
        report[label+'Bytes']=len(data)
        if label=='thumbnail': report['thumbnailIsImage']=response.headers.get_content_type().startswith('image/')
try:
    urllib.request.urlopen(urllib.request.Request(base+'/api/',data=b'function=get_system_status&user=DEV'),timeout=10)
    report['unsignedApiDenied']=False
except urllib.error.HTTPError as error:
    report['unsignedApiDenied']=error.code==401

import datetime
report['checkedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
report['passed']=all(report.get(name) for name in ['signedApiAuthenticated','collectionBrowseVerified','webLoginVerified','originalDownloadVerified','thumbnailDownloadVerified','unsignedApiDenied'])
print(json.dumps(report))
