import { getTools, publicToolRegistry } from "../services/tools.js";
import { executeTool } from "../services/toolHandlers.js";
import { storeSnapshot } from "../services/store.js";

export function mcpCapabilities() {
  return {
    protocol: "jardiyn-mcp-jsonrpc-adapter",
    version: "2025-06-fable5-mythos",
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
      logging: true,
      trace: true
    },
    transport: "HTTP JSON-RPC compatible adapter at /mcp"
  };
}

export function listResources(session_id = "default") {
  return [
    { uri: "garden://profile/current", name: "Current Garden Profile", mimeType: "application/json", description: "Garden Passport and site constraints." },
    { uri: "garden://dashboard/current", name: "Current Garden Dashboard", mimeType: "application/json", description: "Weather, NOAA, frost, pollen, rain, soil, and zone widgets." },
    { uri: "garden://tasks/current", name: "Garden Tasks", mimeType: "application/json", description: "Current task list." },
    { uri: "garden://plants/current", name: "Tracked Plants", mimeType: "application/json", description: "Plant inventory and notes." },
    { uri: "garden://memory/recent", name: "Garden Memory", mimeType: "application/json", description: "Recent notes and agent summaries." }
  ];
}

export function listPrompts() {
  return [
    { name: "weekly-garden-check", description: "Check live conditions and produce a weekly garden action plan." },
    { name: "frost-response-plan", description: "Create a frost/freeze response plan for tender plants." },
    { name: "watering-decision", description: "Use rainfall, weather, and soil to decide watering." },
    { name: "diagnose-plant-issue", description: "Diagnose symptoms conservatively with first safe actions." },
    { name: "build-seasonal-plan", description: "Generate a seasonal plan from zone, soil, weather, and goals." }
  ];
}

export async function readResource(uri, session_id = "default") {
  const snap = storeSnapshot(session_id);
  if (uri === "garden://profile/current") return snap.profile;
  if (uri === "garden://tasks/current") return snap.tasks;
  if (uri === "garden://plants/current") return snap.plants;
  if (uri === "garden://memory/recent") return snap.memory;
  if (uri === "garden://dashboard/current") return { note: "Read /api/dashboard for live-computed dashboard widgets.", profile: snap.profile };
  throw new Error(`Unknown resource ${uri}`);
}

function rpc(id, result) { return { jsonrpc: "2.0", id: id ?? null, result }; }
function rpcError(id, code, message, data) { return { jsonrpc: "2.0", id: id ?? null, error: { code, message, data } }; }

export async function handleMcpRpc(payload = {}, context = {}) {
  const { id, method, params = {} } = payload;
  try {
    if (method === "initialize") return rpc(id, { serverInfo: { name: "JarDIYn MCP", version: "5.2.0" }, capabilities: mcpCapabilities().capabilities });
    if (method === "tools/list") return rpc(id, { tools: getTools() });
    if (method === "tools/call") {
      if (!params.name) return rpcError(id, -32602, "tools/call requires params.name");
      return rpc(id, { content: [{ type: "text", text: JSON.stringify(await executeTool(params.name, params.arguments || {}, { session_id: context.session_id || params.session_id || "default", profile: params.profile || {} }), null, 2) }] });
    }
    if (method === "resources/list") return rpc(id, { resources: listResources(params.session_id || "default") });
    if (method === "resources/read") return rpc(id, { contents: [{ uri: params.uri, mimeType: "application/json", text: JSON.stringify(await readResource(params.uri, params.session_id || "default"), null, 2) }] });
    if (method === "prompts/list") return rpc(id, { prompts: listPrompts() });
    if (method === "prompts/get") return rpc(id, { description: params.name, messages: [{ role: "user", content: { type: "text", text: promptText(params.name) } }] });
    if (method === "registry") return rpc(id, publicToolRegistry());
    return rpcError(id, -32601, `Unknown MCP method ${method}`);
  } catch (error) { return rpcError(id, -32000, error.message); }
}

function promptText(name) {
  const map = {
    "weekly-garden-check": "Use zone, soil, weather, NOAA alerts, frost, pollen, and rainfall to create a practical weekly garden plan.",
    "frost-response-plan": "Check frost/freeze risk and produce a protection plan for tender plants, seedlings, and containers.",
    "watering-decision": "Use rainfall history, forecast, soil, and plant maturity to decide whether to water.",
    "diagnose-plant-issue": "Diagnose symptoms conservatively. Give likely causes, first safe actions, and when to escalate.",
    "build-seasonal-plan": "Create a seasonal planting and maintenance plan from garden profile and live conditions."
  };
  return map[name] || "Use JarDIYn garden intelligence tools before answering.";
}
