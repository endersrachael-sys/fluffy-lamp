/**
 * JarDIYn — Pre-Deploy Verification
 * ==================================
 * Runs WITHOUT an API key. Confirms the project is wired correctly
 * before you deploy. Catches the common "it won't boot" problems.
 *
 * Run:  node verify.mjs
 */

const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", X = "\x1b[0m", B = "\x1b[1m";
let pass = 0, fail = 0;
function check(label, cond, hint = "") {
  cond ? (console.log(`  ${G}✓${X} ${label}`), pass++)
       : (console.log(`  ${R}✗${X} ${label}${hint ? "\n      " + Y + "→ " + hint + X : ""}`), fail++);
}

console.log(`\n${B}JarDIYn — Pre-Deploy Verification${X}\n`);

// 1. Tool definitions load and are well-formed
console.log("Tool definitions (Req 5):");
const { JARDIYN_TOOLS } = await import("./src/services/tools.js");
check("7 tools defined", JARDIYN_TOOLS.length === 7);
JARDIYN_TOOLS.forEach(t => {
  const valid = t.name && t.description && t.input_schema?.type === "object";
  check(`${t.name} has name + description + input_schema`, valid);
});

// 2. Handlers exist and execute (returns real, input-dependent data)
console.log("\nTool execution (Req 6):");
const { dispatchTool } = await import("./src/services/toolHandlers.js");
const z90210 = await dispatchTool("get_garden_zone", { zip_code: "90210" });
const z22030 = await dispatchTool("get_garden_zone", { zip_code: "22030" });
check("get_garden_zone returns data", !!z90210.hardiness_zone);
check("returns DIFFERENT data for different input (not canned)",
  z90210.hardiness_zone !== z22030.hardiness_zone,
  `90210→${z90210.hardiness_zone}, 22030→${z22030.hardiness_zone} should differ`);
const id = await dispatchTool("identify_plant", { symptom_description: "bugs on leaves" });
check("identify_plant returns confidence score", typeof id.top_confidence === "number");
const unknown = await dispatchTool("nonexistent_tool", {});
check("unknown tool handled gracefully", !!unknown.error);

// 3. Agent loop module imports (the routing layer)
console.log("\nAgentic loop (Req 7):");
const agentMod = await import("./src/services/agentLoop.js");
check("runGardenAgent exported", typeof agentMod.runGardenAgent === "function");

// 4. Server module imports
console.log("\nServer + frontend:");
const fs = await import("fs");
check("server.mjs exists", fs.existsSync("./server.mjs"));
check("public/index.html exists", fs.existsSync("./public/index.html"));
const html = fs.readFileSync("./public/index.html", "utf8");
check("frontend calls /api/chat", html.includes("/api/chat"));
check("frontend renders tool trace badges", html.includes("tool-badge"));

// 5. Deployment config present
console.log("\nDeployment config:");
check("render.yaml present", fs.existsSync("./render.yaml"));
check("Dockerfile present", fs.existsSync("./Dockerfile"));
check("package.json has start script",
  JSON.parse(fs.readFileSync("./package.json")).scripts.start === "node server.mjs");
check(".env is gitignored",
  fs.readFileSync("./.gitignore", "utf8").includes(".env"));
check("no .env committed (secret safety)", !fs.existsSync("./.env"),
  "delete .env before committing — only .env.example belongs in the repo");

// 6. API key reminder
console.log("\nRuntime requirement:");
const hasKey = !!process.env.ANTHROPIC_API_KEY;
check("ANTHROPIC_API_KEY set in this shell", hasKey,
  "set it before `node tests/evaluation.mjs` or live use: export ANTHROPIC_API_KEY=sk-ant-...");

// Summary
console.log(`\n${"─".repeat(52)}`);
if (fail === 0) {
  console.log(`${G}${B}✓ READY TO DEPLOY${X}  (${pass} checks passed)`);
  console.log(`${Y}  Next: push to GitHub → deploy on Render → set ANTHROPIC_API_KEY${X}`);
} else {
  console.log(`${R}${B}✗ ${fail} issue(s) to fix${X}  (${pass} passed)`);
}
console.log(`${"─".repeat(52)}\n`);
if (fail > 0 && !(fail === 1 && !hasKey)) process.exit(1);
