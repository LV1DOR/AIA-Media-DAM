# Append to the restore verifier's authenticated prefix. Isolated clone only.
import secrets,datetime
rows=request('do_search',{'search':'','archive':'0','fetchrows':'0,3'})['data']
refs=[int(r['ref']) for r in rows[:2]]
password=secrets.token_hex(24)
created=request('aia_transfer_create',{'resources':','.join(map(str,refs)),'title':'F1-B contract proof','expires':(datetime.date.today()+datetime.timedelta(days=1)).isoformat(),'password':password})
if 'accessKey' not in created: raise ValueError('Plugin did not create a native share')
params={'collection':str(created['collection']),'access_key':created['accessKey']}
proof={'environment':'isolated NAS restore clone','sourceRevision':29907,'pluginVersion':1,'automaticNativeShareCreated':True,'selectedResources':len(refs),'nativeDatabaseFunctionsOnly':True}
def denied(fn, values, statuses=(403,410)):
    try:
        result=request(fn,values)
        return isinstance(result,dict) and 'error' in result
    except urllib.error.HTTPError as e: return e.code in statuses
try:
    manifest=request('aia_transfer_manifest',params)
    proof['manifestMatchesSelection']=sorted(manifest.get('resources',[]))==sorted(refs)
    proof['wrongKeyDenied']=denied('aia_transfer_manifest',{**params,'access_key':'not-a-valid-share-key'})
    proof['outsideResourceDenied']=denied('aia_transfer_download',{**params,'resource':str(rows[2]['ref'])})
    source=request('aia_transfer_download',{**params,'resource':str(refs[0])})['url']
    parsed=urllib.parse.urlsplit(source)
    if parsed.hostname not in allowed_hosts: raise ValueError('Source download escaped isolated origin')
    url=web_base+urllib.parse.urlunsplit(('','',parsed.path,parsed.query,''))
    rjar=http.cookiejar.CookieJar()
    ro=urllib.request.build_opener(IsolatedHttp(),WebRedirect(),urllib.request.HTTPCookieProcessor(rjar),urllib.request.ProxyHandler({}))
    gate=ro.open(url,timeout=15).read().decode()
    f=Form();f.feed(gate)
    p=next(x for x in f.forms if 'share_password' in x)
    proof['nativeOriginalPasswordGate']=True
    p['share_password']=password
    response=ro.open(urllib.request.Request(web_base+'/pages/share_access.php',data=urllib.parse.urlencode(p).encode()),timeout=15)
    data=response.read(50*1024*1024)
    expected={line.split(' ',1)[0] for line in open('/volume1/docker/aia-media-backups/'+credentials['backupId']+'/isolated-restore/filestore.sha256')}
    digest=hashlib.sha256(data).hexdigest()
    proof['nativeOriginalMatchesBackup']=digest in expected
    if not proof['nativeOriginalMatchesBackup']: raise ValueError('Native original bytes did not match recovery')
    # Native API owns the status/access writes. Restore them in finally.
    try:
        request('put_resource_data',{'resource':str(refs[0]),'data':json.dumps({'access':1})})
        proof['restrictionChangeDeniesManifest']=denied('aia_transfer_manifest',params)
    finally: request('put_resource_data',{'resource':str(refs[0]),'data':json.dumps({'access':0})})
    try:
        request('put_resource_data',{'resource':str(refs[0]),'data':json.dumps({'archive':1})})
        proof['unapprovedChangeDeniesManifest']=denied('aia_transfer_manifest',params)
    finally: request('put_resource_data',{'resource':str(refs[0]),'data':json.dumps({'archive':0})})
    proof['restoredApprovalAllowsManifest']=request('aia_transfer_manifest',params).get('active') is True
    proof['revokeSucceeded']=request('aia_transfer_revoke',params).get('revoked') is True
    proof['revokedManifestDenied']=denied('aia_transfer_manifest',params)
    try:
        after=ro.open(url,timeout=15).read(50*1024*1024)
        proof['cachedNativeOriginalDeniedAfterRevoke']=hashlib.sha256(after).hexdigest()!=digest
    except urllib.error.HTTPError as e: proof['cachedNativeOriginalDeniedAfterRevoke']=e.code in (401,403,404,410)
finally:
    if not proof.get('revokeSucceeded'):
        try: request('aia_transfer_revoke',params)
        except Exception: pass
proof['checkedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
proof['passed']=all(proof.get(k) for k in ['automaticNativeShareCreated','manifestMatchesSelection','wrongKeyDenied','outsideResourceDenied','nativeOriginalMatchesBackup','restrictionChangeDeniesManifest','unapprovedChangeDeniesManifest','restoredApprovalAllowsManifest','revokeSucceeded','revokedManifestDenied','cachedNativeOriginalDeniedAfterRevoke'])
print(json.dumps(proof))
