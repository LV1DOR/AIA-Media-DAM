# Appended to verify-restored-rs.py's authenticated-client prefix by the probe.
import datetime,secrets
resources=request('do_search',{'search':'','archive':'0','fetchrows':'0,2'})['data']
existing=request('get_user_collections')
collection=next((c['ref'] for c in existing if c.get('name')=='AIA P1 isolated share proof'),None)
if collection is None: collection=request('create_collection',{'name':'AIA P1 isolated share proof','forupload':'0'})
if not isinstance(collection,(int,str)) or not str(collection).isdigit(): raise ValueError('Collection API did not return an identifier')
for resource in resources:
    request('add_resource_to_collection',{'resource':str(resource['ref']),'collection':str(collection)})
share_page=opener.open(web_base+'/pages/collection_share.php?ref='+str(collection)+'&generateurl=true',timeout=15).read().decode()
share_forms=Form(); share_forms.feed(share_page)
values=next(value for value in share_forms.forms if 'generateurl' in value)
password=secrets.token_hex(16)
expiry=(datetime.date.today()+datetime.timedelta(days=1)).isoformat()
values.update({'ref':str(collection),'access':'0','expires':expiry,'sharepassword':password,'usergroup':'2','generateurl':'1','modal':''})
shared_html=opener.open(urllib.request.Request(web_base+'/pages/collection_share.php?ref='+str(collection),data=urllib.parse.urlencode(values).encode()),timeout=15).read().decode()
class Links(HTMLParser):
    def __init__(self): super().__init__(); self.urls=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='input' and a.get('class')=='URLDisplay' and a.get('value'): self.urls.append(a['value'])
links=Links();links.feed(shared_html)
native=next((url for url in links.urls if 'k=' in url),None)
if not native: raise ValueError('Native share UI did not return a source link')
parts=urllib.parse.urlsplit(native)
key=urllib.parse.parse_qs(parts.query)['k'][0]
print(json.dumps({'privateState':{'collection':str(collection),'nativeUrl':native,'key':key,'password':password,'resourceRefs':[str(x['ref']) for x in resources]},'safeSummary':{'nativeCollectionShareCreated':True,'selectedAssets':len(resources),'passwordRequested':True,'expiryDate':expiry,'sourceCreationRoute':'authenticated native share form','automaticPublicApiCreationProven':False,'productionModified':False}}))
