import { ZipArchive } from "archiver";
// Isolated, synthetic browser QA only. Never used by the NAS deployment.
import { createServer } from "node:http";
if (!process.argv.includes("--synthetic-only"))
  throw new Error("Explicit synthetic-only mode required");
let count = Number(process.env.AIA_FIXTURE_COUNT || 1000);
const scenario = {
  role: process.env.AIA_FIXTURE_ROLE || "reviewer",
  delay: 0,
  error: false,
  broken: false,
  libraryAccess: true,
  chunkDelay: 0,
  tagFailId: 0,
  storageUnavailable: false,
  storageUsedBytes:640*1024**3,
  publicDelay: 0,
  signedIn:true,
  mfaRequired:true,
  inviteError:false,
  mfaError:false,
  publicSeconds:null,
};
const assets = Array.from({ length: count }, (_, i) => ({
  id: i + 1,
  title:
    [
      "Paddock collection",
      "Race weekend",
      "Circuit perspectives",
      "Behind the scenes",
    ][i % 4] +
    " " +
    String(i + 1).padStart(4, "0"),
  filename: `fixture-${i + 1}.jpg`,
  extension: "jpg",
  kind: i % 19 === 0 ? "video" : "photo",
  state: 0,
  access: 0,
  year: String(2024 + (i % 3)),
  event: ["Race weekend", "Testing", "Track day"][i % 3],
  championship: ["GT World Challenge", "ELMS", "MotoGP"][i % 3],
  previewWidth: i % 4 === 0 ? 80 : 180,
  previewHeight: i % 4 === 0 ? 110 : 120,
  bytes: 4500000,
  created: "2026-11-08T09:30:00Z",
}));
const initialAssetCount=assets.length;
const collections = [{ ref: 1, name: "Race weekend selection" }],
  members = new Map([[1, new Set([1, 2, 3, 4])]]),
  transfers = [],
  staff = [],
  invitations = new Map();
const tagValues=new Map();
const tagOptions=[{id:1,name:"Circuit"},{id:2,name:"Racing"},{id:3,name:"Paddock"}];
let sequence = 1;
const requests = [],
  passwords = new Map(),
  unlocked = new Set();
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  requests.push({ path: url.pathname, method: req.method, at: Date.now() });
  if (requests.length > 2000) requests.shift();
  const json = (value, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  if (url.pathname === "/__qa/metrics")
    return json({ requests: requests.slice(-2000), count });
  const buffers = [];
  for await (const b of req) buffers.push(b);
  let body = {};
  try {
    body = JSON.parse(Buffer.concat(buffers).toString() || "{}");
  } catch {}
  if(process.env.AIA_FIXTURE_AUTH_URL && (url.pathname.startsWith("/api/auth/") || url.pathname.startsWith("/api/staff/") || url.pathname.startsWith("/api/admin/users") || url.pathname.startsWith("/api/admin/backgrounds") || url.pathname.startsWith("/api/public/backgrounds"))){
    if(process.env.AIA_FIXTURE_AUTH_URL!=="http://127.0.0.1:4531")throw new Error("Review auth must be loopback-only");
    const upstream=await fetch(process.env.AIA_FIXTURE_AUTH_URL+url.pathname,{method:req.method,headers:{"content-type":req.headers["content-type"]||"application/json",...(req.headers["x-aia-invitation"]?{"x-aia-invitation":req.headers["x-aia-invitation"]}:{}),...(req.headers.cookie?{cookie:req.headers.cookie}:{}),...(req.headers.origin?{origin:req.headers.origin}:{})},...(["GET","HEAD"].includes(req.method)?{}:{body:Buffer.concat(buffers)})});
    res.writeHead(upstream.status,{"Content-Type":upstream.headers.get("content-type")||"application/json","Cache-Control":"no-store","Set-Cookie":upstream.headers.getSetCookie()});return res.end(Buffer.from(await upstream.arrayBuffer()));
  }
  if (url.pathname === "/__qa/config") {
    Object.assign(scenario, body);
    if(body.resetUploads)for(let i=assets.length-1;i>=0;i--)if(assets[i].id>initialAssetCount)assets.splice(i,1);
    if(body.resetTags)tagValues.clear();
    if (Array.isArray(body.pending))
      for (const asset of assets)
        asset.state = body.pending.includes(asset.id) ? -1 : 0;
    if (body.count !== undefined)
      count = Math.max(0, Math.min(assets.length, Number(body.count)));
    return json({ scenario, count });
  }
  if (url.pathname.startsWith("/api/library") && scenario.delay)
    await new Promise((r) => setTimeout(r, scenario.delay));
  if (url.pathname === "/api/library" && scenario.error)
    return json({ error: "Synthetic source unavailable" }, 503);
  if(url.pathname === "/api/public/backgrounds")return json({photos:[]});
  if(url.pathname === "/api/auth/invitation/photo")return json({ok:true});
  if(url.pathname === "/api/auth/profile-photo")return json({error:"Synthetic optional photo unavailable"},404);
  if (url.pathname === "/api/admin/users") {
    if(req.method === "GET")return json({users:staff});
    if(scenario.inviteError)return json({error:"Synthetic invitation failure"},503);
    const token=String(sequence++).padStart(43,"i"),user={id:token,name:body.name,username:body.username,role:body.role,libraryAccess:body.libraryAccess,mfaEnabled:false,invitationPending:true};staff.push(user);invitations.set(token,{user});
    return json({user,invitationUrl:(process.env.AIA_FIXTURE_MEDIA_URL||"http://127.0.0.1:3110")+"/join#"+token,expiresAt:new Date(Date.now()+172800000).toISOString()});
  }
  if(url.pathname === "/api/auth/login"){if(body.password!=="Synthetic-password-only1!")return json({error:"Sign-in details are incorrect"},401);if(scenario.mfaRequired)return json({mfaRequired:true,digits:6,expiresAt:new Date(Date.now()+300000).toISOString()});scenario.signedIn=true;return json({ok:true});}
  if(url.pathname === "/api/auth/verify"){if(body.code!=="123456"||scenario.mfaError)return json({error:"That code is incorrect. Try a current authenticator code."},401);scenario.signedIn=true;return json({ok:true});}
  if(url.pathname === "/api/auth/invitation/read"){const invite=invitations.get(body.token);return invite?json({name:invite.user.name,username:invite.user.username}):json({error:"This invitation is inactive"},410);}
  if(url.pathname === "/api/auth/invitation/start"){const invite=invitations.get(body.token);if(!invite)return json({error:"This invitation is inactive"},410);res.setHeader("Set-Cookie","synthetic_setup="+body.token+"; HttpOnly; SameSite=Strict; Path=/");return json({secret:"SYNTHETICONLY",uri:"otpauth://totp/AIA:synthetic?secret=JBSWY3DPEHPK3PXP&issuer=AIA",expiresAt:new Date(Date.now()+900000).toISOString()});}
  if(url.pathname === "/api/auth/invitation/complete"){if(body.code!=="123456")return json({error:"That code is incorrect. Try a current authenticator code."},401);scenario.signedIn=true;return json({ok:true});}
  if (url.pathname === "/api/auth/me" && !scenario.signedIn)return json({error:"Sign in to continue"},401);
  if (url.pathname === "/api/auth/me")
    return json({
      user: {
        id: "synthetic-reviewer",
        username: "synthetic",
        name: "Frontend QA",
        role: scenario.role,
        libraryAccess: scenario.libraryAccess,
        mfaEnabled: true,
      },
      mediaUrl: process.env.AIA_FIXTURE_MEDIA_URL || "http://127.0.0.1:3110",
      transferUrl:
        process.env.AIA_FIXTURE_TRANSFER_URL || "http://127.0.0.1:3111",
    });
  if (url.pathname === "/api/auth/logout") return json({ ok: true });
  if (url.pathname === "/api/library") {
    let result = assets
      .slice(0, count)
      .filter((a) => a.state === Number(url.searchParams.get("state") || 0));
    const search = url.searchParams.get("search") || "",
      kind = url.searchParams.get("kind");
    const collection = search.match(/!collection(\d+)/);
    if (collection)
      result = result.filter((a) =>
        members.get(Number(collection[1]))?.has(a.id),
      );
    let text = search.replace(/!collection\d+/g, "");
    for (const match of text.matchAll(
      /"(year|event89|championship):([^"]*)"/g,
    )) {
      const key = match[1] === "event89" ? "event" : match[1];
      result = result.filter((a) =>
        String(a[key]).toLowerCase().includes(match[2].toLowerCase()),
      );
    }
    text = text.replace(/"(?:year|event89|championship):[^"]*"/g, "").trim();
    const terms = (text.match(/"[^"]*"|\S+/g) || []).map(term => term.replace(/^"|"$/g, "").normalize("NFKC").toLowerCase());
    if (terms.length)
      result = result.filter(a => {
        const searchable = [a.title,a.filename,a.event,a.year,a.championship,...(tagValues.get(a.id)||["Circuit","Racing"])].join(" ").normalize("NFKC").toLowerCase();
        return terms.every(term => searchable.includes(term));
      });
    if (kind && kind !== "all") result = result.filter((a) => a.kind === kind);
    const page = Number(url.searchParams.get("page") || 0);
    return json({
      items: result.slice(page * 48, page * 48 + 48),
      total: result.length,
      page,
    });
  }
  if(url.pathname === "/api/library/upload" && req.method === "POST"){
    const filename=Buffer.concat(buffers).toString().match(/filename="([^"]+)"/)?.[1]||"synthetic-upload.png";
    const id=Math.max(...assets.map(asset=>asset.id))+1;
    assets.unshift({...assets.find(asset=>asset.kind==="photo"),id,title:filename,filename,extension:filename.split(".").pop(),state:0,bytes:Number(url.searchParams.get("size"))});count++;
    return json({id,state:0});
  }
  if(url.pathname === "/api/storage") return json(scenario.storageUnavailable?{available:false,label:"Application data filesystem"}:{available:true,label:"Synthetic test filesystem",totalBytes:1024**4,availableBytes:1024**4-scenario.storageUsedBytes,usedBytes:scenario.storageUsedBytes,measuredAt:new Date().toISOString()});
  if(url.pathname === "/api/library/tags"){
    const updated=[],failed=[];
    for(const id of body.resourceIds){
      if(id===scenario.tagFailId){failed.push({id,error:"Synthetic native tag denial"});continue;}
      const current=tagValues.get(id)||["Circuit","Racing"];
      const normalize=s=>s.normalize("NFKC").trim().toLowerCase();
      const tags=new Map((body.mode==="replace"?[]:current).map(t=>[normalize(t),t]));
      for(const tag of body.tags){if(body.mode==="remove")tags.delete(normalize(tag));else tags.set(normalize(tag),tagOptions.find(o=>normalize(o.name)===normalize(tag))?.name||tag);}
      for(const tag of tags.values())if(!tagOptions.some(o=>normalize(o.name)===normalize(tag)))tagOptions.push({id:tagOptions.length+1,name:tag});
      tagValues.set(id,[...tags.values()]);updated.push(id);
    }
    return json({updated,failed});
  }
  const match = url.pathname.match(/^\/api\/library\/(\d+)(?:\/(.*))?$/);
  if (match) {
    const a = assets.find((a) => a.id === Number(match[1]));
    if (!a) return json({ error: "Synthetic asset not found" }, 404);
    if(match[2] === "tags") return json({fieldId:1,tags:tagValues.get(a.id)||["Circuit","Racing"],options:tagOptions,editable:true,canCreate:true});
    if (match[2] === "preview") {
      if (scenario.broken && a.id % 3 === 0)
        return json({ error: "Synthetic preview unavailable" }, 404);
      const palette = [
        ["#303b37", "#b7bdb0"],
        ["#77736c", "#dfcba7"],
        ["#496777", "#b8d4de"],
        ["#6a5a55", "#d9afa0"],
      ][a.id % 4];
      const imageWidth =
        url.searchParams.get("size") === "thm"
          ? a.previewWidth
          : a.previewWidth === 80
            ? 800
            : 1200;
      const imageHeight =
        url.searchParams.get("size") === "thm"
          ? a.previewHeight
          : a.previewHeight === 110
            ? 1100
            : 800;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 1200 800"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><path d="M-100 700Q300 120 700 500T1400 100" fill="none" stroke="#ffffff33" stroke-width="150"/><path d="M-100 700Q300 120 700 500T1400 100" fill="none" stroke="#12171388" stroke-width="90"/><rect x="480" y="390" width="190" height="85" rx="26" fill="#f0e9dc" transform="rotate(20 550 400)"/><text x="45" y="740" font-family="sans-serif" font-size="25" fill="#ffffffbb">SYNTHETIC QA · ${a.id}</text></svg>`;
      res.writeHead(200, {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      });
      return res.end(svg);
    }
    if (match[2] === "state") {
      a.state = body.state;
      return json({ ok: true });
    }
    if (match[2] === "metadata") return json({ ok: true });
    if (match[2] === "download") {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename=synthetic.txt",
      });
      return res.end("Synthetic test download");
    }
    return json({
      asset: a,
      collections: collections.filter((c) => members.get(c.ref)?.has(a.id)),
      collectionsAvailable: true,
      fields: [
        { id: 8, title: "Title", name: "title", type: 0, value: a.title },
        { id: 88, title: "Year", name: "year", type: 3, value: a.year },
        { id: 89, title: "Event", name: "event", type: 3, value: a.event },
        {
          id: 90,
          title: "Championship",
          name: "championship",
          type: 0,
          value: a.championship,
        },
        {
          id: 1,
          title: "Keywords",
          name: "keywords",
          type: 9,
          value: (tagValues.get(a.id)||["Circuit","Racing"]).join(", "),
        },
      ],
    });
  }
  if (url.pathname.endsWith("/options"))
    return json({
      options: [
        { id: 1, value: "2026" },
        { id: 2, value: "Race weekend" },
      ],
    });
  if (url.pathname === "/api/collections") {
    if (req.method === "POST") {
      const id = collections.length + 1;
      collections.push({ ref: id, name: body.name });
      members.set(id, new Set(body.resourceIds || []));
      return json({ id, failed: [] });
    }
    return json({ collections });
  }
  const collectionMatch = url.pathname.match(
    /^\/api\/collections\/(\d+)(\/members)?$/,
  );
  if (collectionMatch) {
    const id = Number(collectionMatch[1]),
      collection = collections.find((c) => c.ref === id);
    if (!collection)
      return json({ error: "Synthetic collection missing" }, 404);
    if (collectionMatch[2]) {
      const group = members.get(id) || new Set();
      for (const ref of body.resourceIds || []) {
        if (body.action === "add") group.add(ref);
        else group.delete(ref);
      }
      members.set(id, group);
      return json({ updated: body.resourceIds, failed: [] });
    }
    collection.name = body.name;
    return json({ ok: true });
  }
  if (url.pathname === "/api/transfers") {
    if (req.method === "POST") {
      const t = {
        id: String(sequence++).padStart(43, "s"),
        title: body.title,
        note: body.note || "",
        state: body.resourceIds ? "active" : "draft",
        source: body.resourceIds ? "library" : "temporary",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(
          Date.now() + (body.days || 7) * 86400000,
        ).toISOString(),
        passwordProtected: !!body.password,
        downloadLimit: body.downloadLimit || null,
        downloads: 0,
        fileCount: body.resourceIds?.length || body.files?.length || 1,
        totalBytes:body.resourceIds?body.resourceIds.length*4500000:body.files.reduce((sum,f)=>sum+f.size,0),
        ownerName: "Frontend QA",
        files: body.resourceIds
          ? body.resourceIds.map((id) => ({
              id: "asset-" + id,
              name: "fixture-" + id + ".jpg",
              size: 4500000,
              uploadedBytes: 4500000,
              complete: true,
            }))
          : body.files.map((f, i) => ({
              ...f,
              id: "file-" + i,
              uploadedBytes: 0,
              complete: false,
            })),
      };
      t.link =
        (process.env.AIA_FIXTURE_TRANSFER_URL || "http://127.0.0.1:3111") +
        "/t/" +
        t.id;
      passwords.set(t.id, body.password || "");
      transfers.unshift(t);
      return json({ transfer: t });
    }
    return json({ transfers });
  }
  const transferMatch = url.pathname.match(
    /^\/api\/transfers\/([^/]+)(?:\/(.*))?$/,
  );
  if (transferMatch) {
    const t = transfers.find((t) => t.id === transferMatch[1]);
    if (!t) return json({ error: "Synthetic transfer missing" }, 404);
    const action = transferMatch[2];
    if (action === "chunk") {
      const file = t.files.find((f) => f.id === url.searchParams.get("fileId"));
      file.uploadedBytes =
        Number(url.searchParams.get("offset")) + Buffer.concat(buffers).length;
      if (scenario.chunkDelay)
        await new Promise((r) => setTimeout(r, scenario.chunkDelay));
      return json({ uploadedBytes: file.uploadedBytes });
    }
    if (action === "complete-file")
      t.files.find((f) => f.id === body.fileId).complete = true;
    if (action === "activate") t.state = "active";
    if (action === "revoke") t.state = "revoked";
    return json({ transfer: t, ok: true });
  }
  const publicMatch = url.pathname.match(/^\/api\/public\/([^/]+)(?:\/(.*))?$/);
  if (publicMatch) {
    if(scenario.publicDelay) await new Promise(r=>setTimeout(r,scenario.publicDelay));
    const t = transfers.find((t) => t.id === publicMatch[1]);
    if (!t || t.state !== "active" || Date.parse(t.expiresAt) <= Date.now())
      return json({ error: "Synthetic handoff unavailable" }, 410);
    const action = publicMatch[2];
    if (action === "authorize") {
      if (body.password !== passwords.get(t.id))
        return json({ error: "Incorrect transfer password" }, 401);
      unlocked.add(t.id);
      return json({ ok: true });
    }
    const locked = t.passwordProtected && !unlocked.has(t.id);
    if (action === "archive") {
      if (locked) return json({error:"Transfer password required"},403);
      const zip = new ZipArchive({store:true,forceZip64:true});
      zip.on("error",()=>res.destroy());
      res.writeHead(200,{"Content-Type":"application/zip","Content-Disposition":'attachment; filename="synthetic-originals.zip"'});
      zip.pipe(res);
      for (const f of t.files) zip.append(Buffer.from("Synthetic test download"),{name:f.name});
      void zip.finalize();return;
    }
    if (action?.startsWith("files/")) {
      if (locked) return json({ error: "Transfer password required" }, 401);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename=synthetic.txt",
      });
      return res.end("Synthetic test download");
    }
    return json({ ...t, ...(scenario.publicSeconds!==null?{expiresAt:new Date(Date.now()+scenario.publicSeconds*1000).toISOString()}:{}), locked, files: locked ? [] : t.files });
  }
  if (url.pathname === "/api/library/bulk-metadata")
    return json({ updated: body.resourceIds || [], failed: [] });
  return json({ error: "Synthetic fixture endpoint not implemented" }, 404);
});
server.listen(Number(process.env.AIA_FIXTURE_PORT || 4520), "127.0.0.1", () =>
  console.log(
    `Synthetic QA API http://127.0.0.1:${Number(process.env.AIA_FIXTURE_PORT || 4520)} · ${count} records · no NAS connection`,
  ),
);
