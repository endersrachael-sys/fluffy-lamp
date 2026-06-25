# JarDIYn by GardenHub
### Spatial Garden Intelligence — Agentic AI Platform

> **Plan it. Scan it. Grow it. Export it.**

JarDIYn is a garden intelligence assistant that grounds every recommendation in real data — USDA hardiness zones, soil surveys, weather forecasts, and plant databases. It uses an **agentic Claude loop** where the model autonomously decides which tools to call, whether to call any at all, and how to chain multiple tools across reasoning rounds.

**Live demo:** https://jardiyn.onrender.com *(or deploy your own in 5 minutes — see [DEPLOY.md](DEPLOY.md))*

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

**Quick verify (no API key needed):** `npm install && node verify.mjs` → 21 checks confirm the project is wired correctly before you deploy.

---

## The Problem

Garden planning is fragmented and generic. Homeowners guess their USDA zone, follow advice written for a different climate, and make plant choices that fail because no one told them about their soil pH. Existing tools either give generic LLM outputs detached from real location data, or require expensive professional consultation. There is no tool that combines the immediacy of a conversational AI with the specificity of real soil, zone, and weather data.

**JarDIYn solves this** by combining a conversational garden assistant with live tool calls to USDA, weather, and plant APIs — grounded in the user's actual ZIP code, soil type, and goals.

---

## Who It's For

| User | What they get |
|------|---------------|
| Home gardeners | Zone-specific planting advice, watering decisions grounded in real weather |
| Garden enthusiasts | Plant recommendations matched to their soil, sun, and goals |
| Landscape planners | Monthly DIY reports, design plans, seasonal calendars |
| Anyone with a yard | Pest/disease diagnosis from symptom descriptions |

---

## System Architecture

```
User (browser frontend)
        ↓
Express server (server.mjs) — serves frontend + API
        ↓
POST /api/chat
        ↓
runGardenAgent() [src/services/agentLoop.js]
        ↓
Claude claude-sonnet-4-6 + JARDIYN_TOOLS array
        ↓
Model decides: call tool? which one? loop again? stop?
        ↓ (if tool_use)
dispatchTool() [src/services/toolHandlers.js]
        ↓
Handler executes → returns structured result
        ↓ (tool_result back to Claude)
Model reads result → decides next action
        ↓ (if end_turn)
Final response → client
```

### Components

| File | Role |
|------|------|
| `server.mjs` | Express server, serves frontend + 6 API endpoints |
| `public/index.html` | Full-stack frontend — chat UI, garden profile, tool trace display |
| `src/services/tools.js` | **6 MCP tool definitions** — name, description, input_schema |
| `src/services/agentLoop.js` | **Agentic loop** — model decides; code only dispatches |
| `src/services/toolHandlers.js` | **Tool execution** — handler functions + production swap comments |
| `tests/evaluation.mjs` | 7 planted-signal evaluation tests with execution traces |
| `PROMPT_LOG.md` | Prompt versions 1.0 → 1.2, what changed, why |
| `BUILD_LOG.md` | Full project evolution — what failed, what was fixed |

---

## What Is Agentic About It

**The model drives every routing decision.** `agentLoop.js` contains zero application-level routing logic. No `if (message.includes("plant"))` → call this function. The only branching is on `response.stop_reason` — a value that comes from the model's response, not from reading the user's message.

```js
// This is the ENTIRE routing logic in agentLoop.js:
if (response.stop_reason === "end_turn")  → return the answer
if (response.stop_reason === "tool_use")  → execute what the model chose, loop
```

**The model autonomously decides:**
- Whether to call a tool at all (PS-02: "When to prune hostas?" → no tool, direct answer)
- Which tool to call (PS-03: yellowing leaves → `identify_plant`, not `generate_diy_report`)
- Whether to chain multiple tools (PS-07: unknown ZIP → `get_garden_zone` then `lookup_plant_database`)
- When it has enough information to stop

**The agentic test:** Remove the LLM and replace it with `if/else`. The system fails immediately — no `if/else` tree can distinguish "what perennials grow in partial shade?" (→ `lookup_plant_database`) from "what's wrong with my yellow-spotted tomato?" (→ `identify_plant`) from "should I water today?" (→ `get_weather_forecast`) from "when do I prune hostas?" (→ no tool). These decisions require reading natural language, understanding intent, and matching against tool descriptions.

---

## MCP Tool Definitions

Six tools defined in `src/services/tools.js`, each with `name`, `description`, and `input_schema`:

| Tool | Purpose | Trigger condition |
|------|---------|-------------------|
| `identify_plant` | Plant/pest/disease diagnosis | Visible symptom or image present |
| `get_garden_zone` | USDA hardiness zone + frost dates | Zone unknown in profile |
| `get_soil_data` | Soil type, pH, drainage from USDA SoilWeb | Soil unknown in profile |
| `get_weather_forecast` | 7-day forecast + watering recommendation | Watering question or schedule request |
| `generate_diy_report` | Full monthly DIY garden report | User explicitly asks for a report |
| `lookup_plant_database` | Zone-appropriate plant search | Plant recommendations requested |

The descriptions include explicit "Do NOT call this when..." clauses so the model can discriminate between superficially similar tools.

---

## Tool Execution Loop

```js
// src/services/agentLoop.js — the complete agentic loop

while (rounds < MAX_TOOL_ROUNDS) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    tools: JARDIYN_TOOLS,       // MCP tool definitions (Req 5)
    messages
  });

  if (response.stop_reason === "end_turn") {
    return finalText;           // Model chose to stop
  }

  if (response.stop_reason === "tool_use") {
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const result = await dispatchTool(block.name, block.input);  // Req 6
      toolResults.push({ type: "tool_result", tool_use_id: block.id,
                         content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
    // Loop: model reads result and decides next action (Req 7)
  }
}
```

---

## Grounding

Every response is grounded in at least one of:

| Source | What it provides | Status |
|--------|-----------------|--------|
| Garden profile | Zone, soil, sun, goals, plants | System prompt injection |
| **USDA PHZM (phzmapi.org)** | Hardiness zone by ZIP | **LIVE — no key** |
| **Open-Meteo (NOAA GFS)** | 7-day forecast, frost warning | **LIVE — no key** |
| **SoilGrids (ISRIC)** | Soil texture, pH, clay/sand/silt | **LIVE — no key** |
| Plant.id API | Species candidates, confidence | Mock (swap-ready) |
| Trefle / Perenual | Zone-filtered plant species | Mock (swap-ready) |

The three live sources need **no API key** and are enabled with `LIVE_APIS=true` (on by default in the Render config). Every live call falls back to a realistic mock if the API is unreachable, so the app never breaks. See [INTEGRATIONS.md](INTEGRATIONS.md) for the full integration strategy and recommendations.

---

## Evaluation

Seven planted-signal tests in `tests/evaluation.mjs`. Each verifies a specific autonomous decision.

| Signal | Message | Expected Decision | Pass Condition |
|--------|---------|-------------------|----------------|
| PS-01 | "What to plant? ZIP 22030" — zone unknown | Calls `get_garden_zone` | Tool called |
| PS-02 | "When to prune hostas in Zone 7b?" — zone known | **No tool** | `toolsUsed.length === 0`, `rounds === 1` |
| PS-03 | "Yellow spots and bugs on my tomatoes" | Calls `identify_plant` | Tool called; trace shows `tool_use` block |
| PS-04 | "Should I water today? lat/lng given" | Calls `get_weather_forecast` | Weather-grounded response |
| PS-05 | "Generate my monthly garden report" | Calls `generate_diy_report` | Full report returned |
| PS-06 | "Low-water perennials for Zone 7b partial shade" | Calls `lookup_plant_database` (NOT report tool) | Correct tool discrimination |
| PS-07 | "ZIP 90210 — what vegetables?" — zone unknown | Chains `get_garden_zone` → `lookup_plant_database` | `rounds >= 2`, both tools called |

**PS-02 is the critical test.** An agentic system must know when NOT to call a tool as much as when to call one. A pipeline that always calls `get_garden_zone` would fail PS-02. A pipeline that never calls it would fail PS-01. Only a model making real decisions can pass both.

Run the evaluation:
```bash
node tests/evaluation.mjs
```

---

## Prompt Engineering

Two documented prompt versions in `PROMPT_LOG.md`. Key evolution:

**v1.0:** "You are a helpful garden assistant." — Model never called tools. 0/20 tool calls in test interactions.

**v1.1:** Added profile injection. — Model sometimes called tools but incorrectly discriminated between them. PS-06 failed.

**v1.2 (current):** Three changes:
1. Tool selection guidance moved to tool descriptions, not the system prompt
2. "Do NOT call" clauses added to each tool description
3. Safety rules section added (`## Trust and safety rules`)

Result: All 7 planted signals pass. 17/20 test interactions trigger the correct tool (or correctly no tool).

The key design insight: **routing logic belongs in tool descriptions, not the system prompt.** The system prompt defines role, safety, and style. Tool descriptions carry the when/when-not-to decision logic. This is what keeps the model in the driver's seat.

---

## Setup and Deployment

### Run locally

```bash
git clone https://github.com/your-username/jardiyn
cd jardiyn
npm install
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY=sk-ant-...
node server.mjs
# Open http://localhost:3000
```

### Deploy to Render (recommended — free tier)

1. Fork this repo to your GitHub account
2. Go to [render.com](https://render.com) → New → Web Service → Connect your repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variable: `ANTHROPIC_API_KEY` = your key
6. Deploy — you get a public `https://jardiyn.onrender.com` URL

`render.yaml` in the repo configures this automatically.

### Deploy to Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set ANTHROPIC_API_KEY=sk-ant-...
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | From console.anthropic.com |
| `PORT` | No | Default 3000 |
| `NODE_ENV` | No | `sandbox` (mock data) or `production` (live APIs) |

---

## Known Limitations

| Issue | Severity | Status |
|-------|----------|--------|
| Tool handlers return sandbox mock data | High | Production swap documented in each handler |
| No real plant photo scanning (text only) | Medium | Requires native camera integration |
| No user accounts or persistent storage | Medium | Session memory only; resets on refresh |
| DepthLab / AR features are feature-flagged | Low | Requires ARKit + ground-truth validation |
| History sent from client (token overhead) | Low | Would use server-side session store in production |

---

## What Would Be Fixed with More Time

1. **Live API handlers** — swap each handler's sandbox mock with the real API call (Plant.id, USDA SoilWeb, OpenWeatherMap, Trefle). The agentic loop and frontend don't change.
2. **React Native build** — camera, GPS, push notifications, haptics for App Store submission
3. **Auth + PostgreSQL** — persistent garden profiles, history, and evaluation logs
4. **DepthLab validation** — ground-truth depth accuracy test before enabling spatial features

See `BUILD_LOG.md` for the full iteration history.

---

## Repository Structure

```
jardiyn/
├── server.mjs                   # Express server — frontend + API
├── public/
│   └── index.html               # Complete chat UI
├── src/
│   └── services/
│       ├── tools.js             # 6 MCP tool definitions (Req 5)
│       ├── toolHandlers.js      # Tool execution + dispatch (Req 6)
│       └── agentLoop.js         # Agentic loop — model decides (Req 6+7)
├── tests/
│   └── evaluation.mjs           # 7 planted-signal tests
├── PROMPT_LOG.md                # Prompt versions + rationale (Req 2+3)
├── BUILD_LOG.md                 # Full project evolution (Req 9)
├── render.yaml                  # One-click Render deployment
├── railway.toml                 # One-click Railway deployment
├── package.json
└── .env.example
```

---

## Originality

JarDIYn is not a garden chatbot with a new skin. It is a system designed around a specific architectural problem: **most AI garden tools give the same generic advice regardless of where you actually live.** The approach here — grounding every recommendation in the user's actual USDA zone, local soil survey data, and real-time weather — requires live tool calls, not just better prompts.

The agentic design is also specific to this domain: a gardener asking "should I water today?" needs the weather forecast. A gardener asking "what's wrong with my leaves?" needs plant identification. A gardener asking "when to prune hostas?" needs neither — just expert knowledge. A system that pre-routes these to different functions is a pipeline. A system where the model reads those three questions, understands the intent, and makes three different tool-call decisions is an agent.

The founding proposal (GardenHub) is a real product concept. The agentic intelligence layer built here is what would power it.
