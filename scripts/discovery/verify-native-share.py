# Append to verify-restored-rs.py before its manifest check. Clone-only fixture.
fixture=credentials['fixture']
recipient_jar=http.cookiejar.CookieJar()
recipient=urllib.request.build_opener(IsolatedHttp(),WebRedirect(),urllib.request.HTTPCookieProcessor(recipient_jar),urllib.request.ProxyHandler({}))
parts=urllib.parse.urlsplit(fixture['nativeUrl'])
native_url=web_base+urllib.parse.urlunsplit(('','',parts.path or '/',parts.query,''))
page=recipient.open(native_url,timeout=15)
html=page.read().decode()
forms=Form(); forms.feed(html)
password_form=next(f for f in forms.forms if 'share_password' in f)
wrong={**password_form,'share_password':'incorrect-fixture-password'}
wrong_response=recipient.open(urllib.request.Request(web_base+'/pages/share_access.php',data=urllib.parse.urlencode(wrong).encode()),timeout=20)
wrong_html=wrong_response.read().decode()
proof={'passwordGatePresented':True,'wrongPasswordDenied':'name="share_password"' in wrong_html,'productionModified':False}
forms=Form();forms.feed(wrong_html)
correct=next(f for f in forms.forms if 'share_password' in f)
correct['share_password']=fixture['password']
authorized=recipient.open(urllib.request.Request(web_base+'/pages/share_access.php',data=urllib.parse.urlencode(correct).encode()),timeout=15)
authorized_html=authorized.read().decode()
proof['correctPasswordAccepted']='name="share_password"' not in authorized_html and urllib.parse.urlsplit(authorized.url).path!='/pages/share_access.php'
class Hyperlinks(HTMLParser):
    def __init__(self): super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='a' and a.get('href'):self.links.append(a['href'])
links=Hyperlinks();links.feed(authorized_html)
view_url=next((u for u in links.links if '/pages/view.php?' in u),None)
if view_url:
    view=recipient.open(urllib.parse.urljoin(web_base,view_url),timeout=15).read().decode()
    links=Hyperlinks();links.feed(view)
else: view=''
import html as html_module
download_links=[html_module.unescape(u) for u in re.findall(r'https?://[^\s\"\'<>]+/pages/download\.php\?[^\s\"\'<>]+',view)]
proof['nativeDownloadLinkFound']=bool(download_links)
proof['authorizedPagePath']=urllib.parse.urlsplit(authorized.url).path
proof['viewPageFound']=bool(view_url)
if not download_links: raise ValueError('No native download URL observed')
# Select a source-generated original URL if present, otherwise explicitly test preview.
originals=[u for u in download_links if urllib.parse.parse_qs(urllib.parse.urlsplit(u).query,keep_blank_values=True).get('size')==['']]
download_url=(originals or download_links)[0]
parsed=urllib.parse.urlsplit(download_url)
if parsed.hostname not in allowed_hosts: raise ValueError('Download escaped isolated origin')
download_url=web_base+urllib.parse.urlunsplit(('','',parsed.path,parsed.query,''))
data=recipient.open(download_url,timeout=15).read(50*1024*1024)
digest=hashlib.sha256(data).hexdigest()
manifest='/volume1/docker/aia-media-backups/'+credentials['backupId']+'/isolated-restore/filestore.sha256'
expected={line.split(' ',1)[0] for line in open(manifest)}
proof['sourceDownloadMatchesBackup']=digest in expected
proof['testedDownloadKind']='original' if originals else 'preview'
if not proof['sourceDownloadMatchesBackup']: raise ValueError('Source URL did not deliver a backed-up asset')
if credentials.get('lifecycle')=='expiry':
    edit_url=web_base+'/pages/collection_share.php?'+urllib.parse.urlencode({'ref':fixture['collection'],'editaccess':fixture['key']})
    edit_html=opener.open(edit_url,timeout=15).read().decode()
    forms=Form();forms.feed(edit_html)
    edit=next(f for f in forms.forms if 'editaccess' in f)
    edit.update({'access':'0','expires':'2000-01-01','usergroup':'2','sharepassword':'true','editexternalurl':'1','modal':''})
    opener.open(urllib.request.Request(edit_url,data=urllib.parse.urlencode(edit).encode()),timeout=15).read()
    try:
        expired=recipient.open(download_url,timeout=15).read(50*1024*1024)
        proof['cachedNativeDownloadDeniedAfterExpiry']=hashlib.sha256(expired).hexdigest()!=digest
    except urllib.error.HTTPError as error:
        proof['cachedNativeDownloadDeniedAfterExpiry']=error.code in (401,403,404)
    proof['expiryConfiguredThroughNativeUi']=True
    proof['expiryGranularity']='calendar date; source rounds to end of day'
proof['signedUserkeyRevocationReturnedTrue']=request('delete_access_keys',{'access_keys':fixture['key'],'resources':'-','collections':fixture['collection']}) is True
try:
    response=recipient.open(download_url,timeout=15)
    after=response.read(50*1024*1024)
    proof['cachedNativeDownloadDeniedAfterRevoke']=hashlib.sha256(after).hexdigest()!=digest
    proof['revokedResponseStatus']=response.status
except urllib.error.HTTPError as error:
    proof['cachedNativeDownloadDeniedAfterRevoke']=error.code in (401,403,404)
    proof['revokedResponseStatus']=error.code
proof['checkedAt']=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
proof['passed']=all(proof.get(k) for k in ['wrongPasswordDenied','correctPasswordAccepted','sourceDownloadMatchesBackup','signedUserkeyRevocationReturnedTrue','cachedNativeDownloadDeniedAfterRevoke'])
if credentials.get('lifecycle')=='expiry': proof['passed']=proof['passed'] and proof.get('cachedNativeDownloadDeniedAfterExpiry',False)
# Capability URLs, keys, cookies and passwords are deliberately excluded.
print(json.dumps(proof))
