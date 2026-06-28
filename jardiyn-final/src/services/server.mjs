import http    from "node:http";
import fs      from "node:fs";
import path    from "node:path";
import crypto  from "node:crypto";
import { fileURLToPath } from "node:url";
import { runAgent, isFallbackMode }                                        from "./src/services/agentLoop.js";
import { publicToolRegistry }                                              from "./src/services/tools.js";
import { executeTool, buildDashboard, normalizeGardenProfile }            from "./src/services/toolHandlers.js";
import { addMemory,listMemory,addTask,listTasks,updateTask,addPlant,
         listPlants,saveGardenProfile,getGardenProfile,
         listAgentRuns,clearSession,storeSnapshot }                       from "./src/services/store.js";
import { handleMcpRpc, mcpCapabilities }                                  from "./src/mcp/server.js";
import { liveApisEnabled }                                                from "./src/services/liveApis.js";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT       = Number(process.env.PORT || 3000);
const MAX_BODY   = 1024 * 1024 * 8;
const VERSION    = "6.1.0";
const rateMap    = new Map();

const rid  = ()   => `trace_${crypto.randomBytes(8).toString("hex")}`;
const now  = ()   => new Date().toISOString();
const prod = ()   => process.env.NODE_ENV === "production";
const J    = obj  => JSON.stringify(obj, null, prod() ? 0 : 2);

function csp() {
  return [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "connect-src 'self' https://api.open-meteo.com https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com https://archive-api.open-meteo.com https://api.weather.gov https://api.zippopotam.us",
    "script-src 'self'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ");
}

function secHeaders(tid) {
  return {
    "x-content-type-options":  "nosniff",
    "x-frame-options":         "DENY",
    "referrer-policy":         "strict-origin-when-cross-origin",
    "permissions-policy":      "camera=(self), microphone=(), geolocation=()",
    "content-security-policy": csp(),
    "x-jardiyn-trace-id":      tid,
  };
}

function send(res, status, body, tid, extra={}) {
  res.writeHead(status, { "content-type":"application/json;charset=utf-8", ...secHeaders(tid), ...extra });
  res.end(J(body));
}
const ok   = (res,data,tid,status=200,meta={}) => send(res,status,{ok:true,trace_id:tid,data,meta:{timestamp:now(),...meta}},tid);
const fail = (res,status,code,msg,tid,detail)  => send(res,status,{ok:false,trace_id:tid,error:{code,message:msg,detail},meta:{timestamp:now()}},tid);

function rateLimit(req, pathname) {
  const limit = pathname==="/api/chat"?36:pathname==="/mcp"?90:180;
  const key   = `${String(req.headers["x-forwarded-for"]||req.socket?.remoteAddress||"").split(",")[0].trim()}:${pathname}`;
  const n     = Date.now();
  const r     = rateMap.get(key)||{count:0,reset:n+60000};
  if (n>r.reset){r.count=0;r.reset=n+60000;} r.count++; rateMap.set(key,r);
  return {allowed:r.count<=limit};
}

async function parseBody(req) {
  return new Promise((res,rej)=>{
    let size=0,chunks=[];
    req.on("data",c=>{ size+=c.length; if(size>MAX_BODY){rej(Object.assign(new Error("Body too large"),{code:"BODY_TOO_LARGE"}));req.destroy();return;} chunks.push(c); });
    req.on("end",()=>{ if(!chunks.length) return res({}); try{res(JSON.parse(Buffer.concat(chunks).toString("utf8")));}catch{rej(Object.assign(new Error("Invalid JSON"),{code:"INVALID_JSON"}));} });
    req.on("error",rej);
  });
}

function sid(req,body,url) {
  return String(body.session_id||url.searchParams.get("session_id")||req.headers["x-jardiyn-session"]||"default").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80)||"default";
}

const ALLOWED_PHOTO = new Set(["image/jpeg","image/png","image/webp","image/gif"]);
function validatePhoto(b64,declared) {
  if(!ALLOWED_PHOTO.has(declared)) return {ok:false,error:`Unsupported type: ${declared}`};
  const prefix=b64.slice(0,8);
  const expected={"image/jpeg":"/9j/","image/png":"iVBOR","image/webp":"UklGR","image/gif":"R0lGOD"}[declared];
  if(expected&&!prefix.startsWith(expected.slice(0,prefix.length))) return {ok:false,error:`Declared ${declared} but bytes don't match`};
  return {ok:true};
}

async function router(req,res,tid) {
  const url  = new URL(req.url,`http://${req.headers.host||"localhost"}`);
  const meth = req.method||"GET";
  const p    = url.pathname.startsWith("/api/v1/")?url.pathname.replace("/api/v1","/api"):url.pathname;
  if(!rateLimit(req,p).allowed) return fail(res,429,"RATE_LIMITED","Too many requests.",tid);
  let body={};
  if(!["GET","HEAD"].includes(meth)) body=await parseBody(req);
  const session=sid(req,body,url);
  const saved=getGardenProfile(session);

  // ── Discovery ──────────────────────────────────────────────────────────────
  if(meth==="GET"&&p==="/api/health")
    return ok(res,{service:"jardiyn",status:"healthy",version:VERSION},tid);
  if(meth==="GET"&&p==="/api/status")
    return ok(res,{service:"jardiyn",status:"ready",version:VERSION,env:process.env.NODE_ENV||"development",live_apis:liveApisEnabled(),anthropic_configured:Boolean(process.env.ANTHROPIC_API_KEY),fallback_agent:isFallbackMode(),persistence:"json-file-store",mcp:"/mcp"},tid);
  if(meth==="GET"&&p==="/api/tools")      return ok(res,publicToolRegistry(),tid);
  if(meth==="GET"&&p==="/api/sources")    return ok(res,{sources:sources(),live_apis_enabled:liveApisEnabled()},tid);
  if(meth==="GET"&&p==="/api/evaluation") return ok(res,{rubric:rubric(),version:VERSION},tid);
  if(meth==="GET"&&p==="/api/mcp/capabilities") return ok(res,mcpCapabilities(),tid);
  if(meth==="GET"&&p==="/.well-known/jardiyn.json") return ok(res,{name:"JarDIYn by GardenHub",version:VERSION,api:"/api",mcp:"/mcp",tools:"/api/tools"},tid);

  // ── Dashboard ──────────────────────────────────────────────────────────────
  if(["GET","POST"].includes(meth)&&p==="/api/dashboard"){
    const incoming=meth==="GET"?Object.fromEntries(url.searchParams):(body.profile||body);
    const profile=normalizeGardenProfile({...saved,...incoming});
    saveGardenProfile(session,profile);
    return ok(res,await buildDashboard(profile),tid);
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  if(meth==="POST"&&p==="/api/chat"){
    if(!String(body.message||"").trim()) return fail(res,400,"INVALID_MESSAGE","message is required.",tid);
    const profile=normalizeGardenProfile({...saved,...(body.profile||{})});
    saveGardenProfile(session,profile);
    return ok(res,await runAgent({message:String(body.message).slice(0,4000),profile,session_id:session,save_suggestions:body.save_suggestions===true}),tid);
  }

  // ── Photo / identify ───────────────────────────────────────────────────────
  if(meth==="POST"&&p==="/api/identify"){
    const {image_base64,image_media_type="image/jpeg",symptoms,profile:bP}=body;
    if(image_base64){
      const v=validatePhoto(image_base64,image_media_type);
      if(!v.ok) return fail(res,400,"INVALID_PHOTO",v.error,tid);
      console.log(`[identify] accepted: ${image_media_type} ~${Math.round(image_base64.length*.75)} bytes`);
    }
    const profile=normalizeGardenProfile({...saved,...(bP||{})});
    return ok(res,{result:await executeTool("diagnose_plant_issue",{...profile,symptoms:symptoms||body.message||"Photo diagnosis",has_photo:Boolean(image_base64)},{profile,session_id:session})},tid);
  }

  // ── Plan/report/zone ───────────────────────────────────────────────────────
  if(meth==="POST"&&p==="/api/zone")     return ok(res,{result:await executeTool("get_garden_zone",body,{session_id:session})},tid);
  if(meth==="POST"&&p==="/api/report")   return ok(res,{result:await executeTool("generate_diy_report",body,{profile:body.profile||saved,session_id:session})},tid);
  if(meth==="POST"&&p==="/api/design")   return ok(res,{result:await executeTool("generate_garden_plan",body,{profile:body.profile||saved,session_id:session})},tid);
  if(meth==="POST"&&p==="/api/schedule") return ok(res,{result:await executeTool("generate_garden_plan",{...body,horizon:body.horizon||"weekend"},{profile:body.profile||saved,session_id:session})},tid);

  // ── Profile ────────────────────────────────────────────────────────────────
  if(p==="/api/profile"){
    if(meth==="GET")  return ok(res,{session_id:session,profile:saved},tid);
    if(meth==="POST") return ok(res,{session_id:session,profile:saveGardenProfile(session,normalizeGardenProfile(body.profile||body))},tid,201);
  }

  // ── Memory / tasks / plants ────────────────────────────────────────────────
  if(p==="/api/memory"){
    if(meth==="GET")  return ok(res,{session_id:session,memory:listMemory(session)},tid);
    if(meth==="POST") return ok(res,{session_id:session,item:addMemory(session,body)},tid,201);
  }
  if(p==="/api/tasks"){
    if(meth==="GET")   return ok(res,{session_id:session,tasks:listTasks(session)},tid);
    if(meth==="POST")  return ok(res,{session_id:session,task:addTask(session,body)},tid,201);
    if(meth==="PATCH") return ok(res,{session_id:session,task:updateTask(session,body.id,body.patch||body)},tid);
  }
  // PATCH task complete by ID
  const taskComplete = p.match(/^\/api\/tasks\/([^/]+)\/complete$/);
  if(taskComplete&&meth==="POST") return ok(res,{session_id:session,task:updateTask(session,taskComplete[1],{status:"done",completed_at:now()})},tid);

  if(p==="/api/plants"){
    if(meth==="GET")  return ok(res,{session_id:session,plants:listPlants(session)},tid);
    if(meth==="POST") return ok(res,{session_id:session,plant:addPlant(session,body)},tid,201);
  }

  // ── Session / runs / MCP ───────────────────────────────────────────────────
  if(meth==="GET"&&p==="/api/runs")          return ok(res,{runs:listAgentRuns(40)},tid);
  if(meth==="GET"&&p==="/api/session")       return ok(res,storeSnapshot(session),tid);
  if(meth==="POST"&&p==="/api/session/clear") return ok(res,clearSession(session),tid);
  if(meth==="POST"&&p==="/mcp")              return send(res,200,await handleMcpRpc(body,{session_id:session}),tid);

  return fail(res,404,"NOT_FOUND",`No route: ${meth} ${p}`,tid);
}

function serveStatic(req,res,tid) {
  const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
  let p=decodeURIComponent(url.pathname);
  if(p==="/"||!path.extname(p)) p="/index.html";
  const file=path.resolve(PUBLIC_DIR,`.${p}`);
  if(!file.startsWith(PUBLIC_DIR)) return fail(res,403,"FORBIDDEN","Forbidden",tid);
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory()){
    const idx=path.join(PUBLIC_DIR,"index.html");
    if(fs.existsSync(idx)){res.writeHead(200,{"content-type":"text/html;charset=utf-8",...secHeaders(tid),"cache-control":"no-cache"});fs.createReadStream(idx).pipe(res);return;}
    return fail(res,404,"NOT_FOUND","Not found",tid);
  }
  const types={".html":"text/html;charset=utf-8",".css":"text/css;charset=utf-8",".js":"text/javascript;charset=utf-8",".svg":"image/svg+xml",".ico":"image/x-icon",".json":"application/json"};
  const ext=path.extname(file);
  res.writeHead(200,{"content-type":types[ext]||"application/octet-stream",...secHeaders(tid),"cache-control":prod()&&ext!==".html"?"public,max-age=3600":"no-cache"});
  fs.createReadStream(file).pipe(res);
}

function sources() {
  const live=liveApisEnabled();
  return [
    {id:"weather.openmeteo",name:"Open-Meteo Forecast",category:"Weather",mode:live?"live":"fallback",endpoint:"get_weather_forecast",freshness:"current + 7-day forecast"},
    {id:"noaa.alerts",name:"NOAA / National Weather Service",category:"NOAA / NWS",mode:live?"live":"fallback",endpoint:"get_noaa_alerts",freshness:"active alerts"},
    {id:"airquality.openmeteo",name:"Open-Meteo Air Quality",category:"Pollen",mode:live?"live":"fallback",endpoint:"get_pollen_forecast",freshness:"hourly forecast"},
    {id:"archive.openmeteo",name:"Open-Meteo Archive",category:"Rainfall",mode:live?"live":"fallback",endpoint:"get_recent_rainfall",freshness:"14-day historical precipitation"},
    {id:"zip.zippopotamus",name:"Zippopotam.us",category:"Location",mode:live?"live":"local cache",endpoint:"get_garden_zone",freshness:"on request"},
    {id:"soil.soilgrids",name:"SoilGrids/ISRIC adapter",category:"Soil",mode:"adapter-ready + profile fallback",endpoint:"get_soil_profile",freshness:"profile/current"},
    {id:"plants.openfarm",name:"OpenFarm + iNaturalist adapter",category:"Plants",mode:"adapter-ready + curated fallback",endpoint:"lookup_plant_database",freshness:"on request"},
  ];
}
function rubric() {
  return [
    {gate:"UX",check:"Ask-first flow. Signal stack folds behind answers, not displayed as product."},
    {gate:"API",check:"Every route returns {ok,trace_id,data,meta} envelope."},
    {gate:"Agent",check:"Fallback mode is agentic and tool-using without API key."},
    {gate:"Anthropic",check:"claude-sonnet-4-6 with 5-round tool loop, voice rules, usage tracking."},
    {gate:"MCP",check:"JSON-RPC: initialize, tools/list, tools/call, resources/list, resources/read, prompts/list."},
    {gate:"Security",check:"CSP, rate limiting (36/min chat), body limits (8MB), x-jardiyn-trace-id, photo validation."},
    {gate:"Persistence",check:"Profiles, memory, tasks, plants, runs via JSON-file store."},
    {gate:"Photo",check:"Client normalizes to JPEG via Canvas. Server validates MIME + byte prefix."},
    {gate:"Deploy",check:"Render. npm install / npm start. Node 20+. ANTHROPIC_API_KEY in environment."},
  ];
}

const server = http.createServer(async (req,res)=>{
  const tid=rid();
  try{
    const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
    if(req.method==="OPTIONS"){res.writeHead(204,{...secHeaders(tid),"access-control-allow-methods":"GET,POST,PATCH,OPTIONS","access-control-allow-headers":"content-type,authorization,x-jardiyn-session"});res.end();return;}
    const isApi=url.pathname.startsWith("/api")||url.pathname==="/mcp"||url.pathname==="/.well-known/jardiyn.json";
    if(isApi) return await router(req,res,tid);
    return serveStatic(req,res,tid);
  }catch(error){
    const status=error.code==="BODY_TOO_LARGE"?413:error.code==="INVALID_JSON"?400:500;
    return fail(res,status,error.code||"SERVER_ERROR",error.message||"Server error",tid,prod()?undefined:{stack:error.stack});
  }
});

server.listen(PORT,()=>{
  console.log(`\nJarDIYn v${VERSION} → http://localhost:${PORT}`);
  console.log(`Agent: ${isFallbackMode()?"fallback/keyless":"claude-sonnet-4-6 live"}`);
  console.log(`APIs:  ${liveApisEnabled()?"LIVE":"fallback"} | MCP: /mcp\n`);
});
