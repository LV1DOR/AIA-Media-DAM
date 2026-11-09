"""Configure metadata and a separate user-management identity through native functions."""
import subprocess,json,pathlib,os
php='''chdir("/var/www/html");include "include/boot.php";include_once "include/api_functions.php";
setup_user(get_user(get_user_by_username("DEV")));
$groups=array_values(array_filter(get_usergroups(),fn($g)=>$g["name"]==="AIA Account Provisioning"));
$group=$groups?(int)$groups[0]["ref"]:(int)save_usergroup(0,["name"=>"AIA Account Provisioning","permissions"=>"t,u"]);
save_usergroup($group,["name"=>"AIA Account Provisioning","permissions"=>"t,u"]);
$username="aia_account_service";$ref=get_user_by_username($username);if(!$ref){$ref=new_user($username,$group);}
if(!$ref||save_user($ref,["fullname"=>"AIA account provisioning service","usergroup"=>$group,"approved"=>1])!==true){throw new Exception("Native service activation failed");}
$definitions=[["Championship","championship",0],["Rights and licensing","aiarights",1]];
$existing=get_resource_type_fields();$fields=[];
foreach($definitions as [$title,$name,$type]){$found=array_values(array_filter($existing,fn($f)=>$f["name"]===$name));$fields[$name]=$found?(int)$found[0]["ref"]:(int)create_resource_type_field($title,[1,3],$type,$name,true);}
echo json_encode(["identity"=>["user"=>$username,"key"=>get_api_key($ref)],"group"=>$group,"metadataFields"=>$fields]);'''
result=json.loads(subprocess.check_output(['docker','exec','resourcespace','php','-r',php]))
env=pathlib.Path('/volume1/docker/aia-media-ecosystem/.private/app.env')
lines=[line for line in env.read_text().splitlines() if not line.startswith(('AIA_RS_PROVISION_USER=','AIA_RS_PROVISION_KEY='))]
env.write_text('\n'.join(lines+['AIA_RS_PROVISION_USER='+result['identity']['user'],'AIA_RS_PROVISION_KEY='+result['identity']['key']])+'\n');env.chmod(0o600)
print(json.dumps(result))
