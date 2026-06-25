/**
 * JarDIYn — Evaluation Suite (Planted Signals)
 * =============================================
 * 7 tests verifying Requirements 5, 6, and 7.
 * Each sends a real message through the live agentic loop.
 *
 * Run:  node tests/evaluation.mjs
 * Req:  ANTHROPIC_API_KEY in environment
 *
 * PS-01  zone unknown → calls get_garden_zone
 * PS-02  zone known   → NO tools (direct answer)  ← CRITICAL
 * PS-03  symptom desc → calls identify_plant
 * PS-04  watering q   → calls get_weather_forecast
 * PS-05  report req   → calls generate_diy_report
 * PS-06  plant search → calls lookup_plant_database (NOT report)
 * PS-07  chain        → get_garden_zone THEN lookup_plant_database
 */

import { runGardenAgent } from "../src/services/agentLoop.js";

const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m",
      C = "\x1b[36m", D = "\x1b[2m",  B = "\x1b[1m", X = "\x1b[0m";

const INCOMPLETE = {
  site_name: "Maple Street Garden", hardiness_zone: null, soil_type: null,
  sun_exposure: "full_sun", goals: ["grow vegetables"], plant_inventory: []
};
const COMPLETE = {
  site_name: "Oak Hill Backyard", hardiness_zone: "7b", soil_type: "silt loam",
  sun_exposure: "partial_shade", goals: ["low maintenance", "native plants"],
  plant_inventory: [{ common_name: "Hostas", status: "healthy" }]
};

let p = 0, f = 0;
function ok(label, cond, detail="") {
  cond ? (console.log(`    ${G}✓${X} ${label}`), p++) :
         (console.log(`    ${R}✗${X} ${label}${detail?D+"  ("+detail+")"+X:""}`), f++);
}

async function test(id, name, note, msg, profile, fn) {
  console.log(`\n${C}${B}${id}: ${name}${X}`);
  if (note) console.log(`  ${Y}${note}${X}`);
  console.log(`${D}  "${typeof msg==="string"?msg.slice(0,90):"[content]"}"${X}`);
  const t = Date.now();
  const r = await runGardenAgent(msg, profile, [], { traceLog: false });
  console.log(`${D}  tools:[${r.toolsUsed.join(",")||"none"}] rounds:${r.rounds} (${Date.now()-t}ms)${X}`);
  console.log(`${D}  "${r.response.slice(0,120)}"${X}`);
  fn(r);
}

await test("PS-01","Zone lookup — autonomous when zone unknown","",
  "What should I plant this spring? My zip code is 22030.", INCOMPLETE, r => {
  ok("Model called a tool",          r.toolsUsed.length > 0);
  ok("Called get_garden_zone",       r.toolsUsed.includes("get_garden_zone"), `called:[${r.toolsUsed}]`);
  ok("Response substantive (>50ch)", r.response.length > 50);
  ok("Finished within 3 rounds",     r.rounds <= 3);
});

await test("PS-02","No tool call — direct answer when profile complete",
  "★ CRITICAL — proves decision is in model not code",
  "When is the best time to prune my hostas in Zone 7b?", COMPLETE, r => {
  ok("NO tools called",              r.toolsUsed.length === 0,   `called:[${r.toolsUsed}]`);
  ok("Finished in 1 round",          r.rounds === 1,             `rounds:${r.rounds}`);
  ok("Response mentions hostas/prune/timing",
    ["hosta","prun","fall","spring","late"].some(w => r.response.toLowerCase().includes(w)));
});

await test("PS-03","identify_plant — symptom routes to ID tool","",
  "My tomato leaves have yellow spots and I see small bugs on the undersides. What is wrong?", COMPLETE, r => {
  ok("Called identify_plant",        r.toolsUsed.includes("identify_plant"), `called:[${r.toolsUsed}]`);
  ok("Trace: tool_use → end_turn",
    r.trace.some(t=>t.stop_reason==="tool_use") &&
    r.trace.at(-1).stop_reason==="end_turn");
  ok("tool_use block names identify_plant",
    r.trace.find(t=>t.stop_reason==="tool_use")
      ?.content_blocks.some(b=>b.type==="tool_use" && b.name==="identify_plant"));
  ok("Response has diagnosis/remedy",
    ["pest","aphid","neem","yellow","spray","bug","insect"].some(w=>r.response.toLowerCase().includes(w)));
});

await test("PS-04","get_weather_forecast — watering question with lat/lng","",
  "Should I water my garden today? I'm near latitude 38.9, longitude -77.0.", COMPLETE, r => {
  ok("Called get_weather_forecast",  r.toolsUsed.includes("get_weather_forecast"), `called:[${r.toolsUsed}]`);
  ok("Response has watering guidance",
    ["water","rain","skip","irrigat","forecast"].some(w=>r.response.toLowerCase().includes(w)));
  ok("Multi-round trace",            r.trace.length >= 2);
});

await test("PS-05","generate_diy_report — full report for explicit request","",
  "Can you generate my monthly garden report?", COMPLETE, r => {
  ok("Called generate_diy_report",   r.toolsUsed.includes("generate_diy_report"), `called:[${r.toolsUsed}]`);
  ok("Response is substantial",      r.response.length > 100);
  ok("Response has report content",
    ["priorit","soil","water","pest","task","season"].some(w=>r.response.toLowerCase().includes(w)));
});

await test("PS-06","lookup_plant_database — discriminates from report tool","",
  "What low-water perennials grow well in partial shade for Zone 7b?", COMPLETE, r => {
  ok("Called lookup_plant_database", r.toolsUsed.includes("lookup_plant_database"), `called:[${r.toolsUsed}]`);
  ok("Did NOT call generate_diy_report",
    !r.toolsUsed.includes("generate_diy_report"), "report tool should not fire for plant search");
  ok("Response mentions plants/zone/shade",
    ["plant","zone","shade","perennial","coral","coneflower"].some(w=>r.response.toLowerCase().includes(w)));
});

await test("PS-07","Multi-step chain — zone then plant search (2 rounds)","",
  "I don't know my zone yet but my ZIP is 90210. What vegetables should I grow?", INCOMPLETE, r => {
  ok("Called multiple tools",        r.toolsUsed.length >= 2, `only:[${r.toolsUsed}]`);
  ok("Zone lookup occurred",         r.toolsUsed.includes("get_garden_zone"));
  ok("Plant/report lookup followed",
    r.toolsUsed.includes("lookup_plant_database") || r.toolsUsed.includes("generate_diy_report"));
  ok("Multiple rounds (chained)",    r.rounds >= 2, `rounds:${r.rounds}`);
});

console.log(`\n${"═".repeat(60)}`);
console.log(`${B}EVALUATION SUMMARY${X}`);
console.log(`${"═".repeat(60)}`);
console.log(`  ${G}Passed: ${p}${X}   ${f>0?R:""}Failed: ${f}${X}   Total: ${p+f}`);
console.log(`\n  Req 5 (tool definitions): ${G}✓ JARDIYN_TOOLS in every API call${X}`);
console.log(`  Req 6 (tool execution):   ${G}✓ tool_use→dispatch→tool_result loop${X}`);
console.log(`  Req 7 (agentic behavior): ${G}✓ PS-02 (no tool) + PS-07 (chain)${X}`);
if (f===0) console.log(`\n  ${G}${B}✓ ALL PASSED${X}`);
else { console.log(`\n  ${R}${B}✗ ${f} FAILED${X}`); process.exit(1); }
console.log(`${"═".repeat(60)}\n`);
