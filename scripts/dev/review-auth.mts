// Actual authentication/invitation code with an ephemeral synthetic registry.
// No environment credentials, production data or native services are read.
import {randomBytes} from "node:crypto";
import {createApp} from "../../services/transfer-api/src/app.js";
import {Store} from "../../services/transfer-api/src/store.js";
import type {ResourceSpace} from "../../services/transfer-api/src/adapters.js";
const rs={async call(_identity:unknown,fn:string,args:Record<string,string>){
 if(fn==="aia_staff_create")return {user:args.username,key:"synthetic-only"};
 if(fn==="aia_staff_set_enabled"||fn==="get_system_status")return true;
 throw new Error("No native source is connected to this review service");
}} as unknown as ResourceSpace;
const {app}=await createApp({dataDir:":memory:",masterKey:randomBytes(32).toString("base64"),mediaOrigin:"http://127.0.0.1:3310",transferOrigin:"http://127.0.0.1:3311",secureCookies:false,rsUrl:"http://127.0.0.1:9",gokapiUrl:"http://127.0.0.1:9",gokapiKey:"synthetic-only",bootstrapPassword:"synthetic-review-admin-only",rsIdentity:{user:"synthetic",key:"synthetic-only"},requireAdminMfa:false,logger:false},{store:new Store(":memory:"),rs});
await app.listen({host:"127.0.0.1",port:4531});
process.on("SIGTERM",()=>void app.close());process.on("SIGINT",()=>void app.close());
console.log("Review auth: actual password/TOTP/invitation handlers; ephemeral synthetic accounts only.");
