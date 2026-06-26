# JarDIYn — Build Log

What was tried, what failed, what changed, and why. Rubric point 9.

---

## The Starting Point

JarDIYn began as a mobile app development proposal for GardenHub — a garden intelligence platform pitched as a consumer app combining AI recommendations, plant scanning, 3D/AR design, and smart home integration. The proposal had seven slides, a logo, and an idea. It had no code.

The design challenge for this project: take a real product proposal and build the AI intelligence layer that would actually make it work — specifically the agentic tool-calling system that grounds every recommendation in real data rather than generic LLM output.

---

## Iteration 1 — Direct API Calls (Failed)

**What was built:**
A simple Express server with endpoints that called Claude with a static prompt and returned the response. `mockApi.js` returned hardcoded data structures. A `ruleEngine.js` file used `if/else` to route user input to different service functions.

**What failed:**
- `ruleEngine.js` was a pipeline, not an agent. The LLM had no decision-making role — it was just a text generator at the end of a pre-decided routing chain.
- `mockApi.js` responses were canned. The model never saw real data; it was handed pre-written JSON that didn't change based on the user's actual location.
- Replacing the LLM with `if/else` would have produced nearly identical behavior. That is the definition of "not agentic."
- No formal tool definitions — tools were just internal function calls the model never knew about.

**The insight:**
The problem was architectural, not prompt-level. Fixing the prompts wouldn't fix an architecture where the code, not the model, made every decision.

---

## Iteration 2 — Agentic Loop Implementation

**What changed:**

**Deleted:** `ruleEngine.js` — all routing logic removed from application code.

**Deleted:** `mockApi.js` — replaced by proper tool handlers where the model explicitly calls and receives results.

**Created:** `src/services/tools.js` — 6 formal MCP tool definitions with `name`, `description`, and `input_schema`. The descriptions were written so the model could autonomously determine when each tool was appropriate.

**Created:** `src/services/toolHandlers.js` — handler functions that execute each tool and return structured results. Each has a labeled sandbox mock and a production swap comment.

**Created:** `src/services/agentLoop.js` — the core `while` loop. Reads `stop_reason` from Claude's response. If `tool_use`, dispatches to handler and loops. If `end_turn`, returns. Zero application-level routing.

**First test result:**
- PS-01 (zone lookup when zone unknown): ✓ passed
- PS-02 (no tool when zone known): ✗ failed — model still called `get_garden_zone` unnecessarily

**Fix:** Added explicit guidance in the system prompt: "Do not call a tool if you already have the information needed to answer well." This moved PS-02 from fail to pass.

---

## Iteration 3 — Tool Description Precision

**Problem discovered in testing:**
PS-06 was failing. When asked "low-water perennials for Zone 7b partial shade," the model was calling `generate_diy_report` instead of `lookup_plant_database`. Both tools were plausibly related to the question.

**Root cause:**
The tool descriptions were too similar in their trigger language. Both mentioned "zone" and "plant recommendations." The model had no basis to distinguish them.

**Fix:** Added explicit negative cases to tool descriptions.
- `generate_diy_report`: "Do NOT call this for a single quick question — use it only when a full report is appropriate."
- `lookup_plant_database`: "Do NOT call this for pest or disease identification — use identify_plant for that."

**Result:** PS-06 passed. The model correctly routes plant recommendation questions to `lookup_plant_database` and report requests to `generate_diy_report`.

**Insight:** Tool descriptions need "Do NOT call when" clauses as much as they need "Call when" clauses. Models over-call available tools without this constraint.

---

## Iteration 4 — Multi-turn and History

**Problem discovered:**
Each `/api/chat` call was stateless. The model had no memory of previous turns. Users who said "tell me more about that" got a confused response.

**Fix:** Added `history` array to the chat endpoint request body and the frontend JavaScript. Conversation history is injected into `messages` at the start of each `runGardenAgent` call. History is capped at 20 messages (10 turns) to prevent context overflow.

**Tradeoff documented:** Longer history = more tokens per request = higher cost. For a production system, this would use a proper session store with server-side history rather than sending full history from the client.

---

## Iteration 5 — Frontend for Rubric Point 1 (Deployment)

**Problem:**
The rubric requires "a URL I can open and use" — not localhost, not a screenshot. An API-only server doesn't satisfy this. A grader who hits the URL needs to actually interact with the application.

**What was built:**
`public/index.html` — a complete single-file frontend that:
- Shows the garden profile sidebar (ZIP, soil, sun, goals)
- Renders chat messages with markdown formatting
- Displays tool trace badges below each response (transparency about which tools fired)
- Shows the "no tools — direct answer" case to demonstrate agentic decision-making
- Has 5 quick-action buttons and 4 welcome prompts pre-loaded with real test cases
- Maintains multi-turn conversation history
- Is served as a static file by `server.mjs` — same port, same process, same deployment URL

**Design decision:** Tool call transparency was added to the UI explicitly. Each assistant message shows which tools were called (in green) or "no tools — direct answer" when the model decided not to call any. This makes the agentic behavior visible to the grader without requiring them to read logs.

---

## Iteration 6 — Evaluation Suite

**What was built:** `tests/evaluation.mjs` — 7 planted signal tests covering each major decision type.

**Why these 7 signals:**
- PS-01 and PS-02 together prove autonomous tool selection AND autonomous non-selection. Both cases are required to distinguish an agent from a pipeline.
- PS-03 tests the identify_plant execution path end-to-end (Requirement 6)
- PS-04 tests weather-grounded watering decisions
- PS-05 tests the full report generation path
- PS-06 is the hardest signal: it requires the model to discriminate between two superficially similar tools based on the question type
- PS-07 is the multi-step chaining signal: model must call get_garden_zone, receive the result, then decide to call lookup_plant_database — across two separate rounds

**What the evaluation proves:**
The combination of PS-01 (tool called) and PS-02 (no tool called, 1 round) together demonstrate that the model is making real decisions. A hardcoded routing system could not produce this behavior — it would either always call the zone tool or never call it.

---

## What Broke Along the Way

**CORS errors in the frontend:** Fixed by serving the frontend from the same Express server rather than a separate origin.

**Tool result serialization:** First attempt used `JSON.stringify(result)` directly as the `content` field. This caused Claude to occasionally mis-parse nested JSON. Fixed by ensuring consistent flat structure in each handler's return object.

**History growing unbounded:** An early bug let history grow indefinitely. Fixed with a `slice(-20)` cap.

**Tool over-calling on long conversations:** When history was long, the model sometimes called tools unnecessarily because older conversation messages implied the profile was incomplete. Fixed by always injecting the current garden profile fresh in the system prompt, not relying on history for profile state.

---

## What Would Be Fixed with More Time

**Priority 1 — Live API handlers:**
All tool handlers currently return sandbox mock data (clearly labeled). Production would swap each handler body with a real API call:
- `identify_plant` → Plant.id API v3
- `get_garden_zone` → USDA PHZM API via phzmapi.org
- `get_soil_data` → USDA SoilWeb / SoilWeb API
- `get_weather_forecast` → OpenWeatherMap One Call API 3.0
- `lookup_plant_database` → Trefle API

The agentic loop, tool definitions, and frontend do not change. Only the handler bodies.

**Priority 2 — React Native mobile build:**
The frontend is a PWA served from Express. A native React Native / Expo build would add camera access for real plant photo scanning, GPS for automatic zone lookup, push notifications for watering reminders, and haptics. This is required for App Store submission.

**Priority 3 — Real image benchmark:**
Plant.id identification accuracy should be validated against a ground-truth test set (≥50 labeled garden photos) before claiming production accuracy. The current system uses text symptom descriptions; adding real image support requires the vision content array format in the API call.

**Priority 4 — DepthLab validation:**
The spatial capture pipeline (ARKit → depth map → scene graph → JSON export) is feature-flagged and sandbox-only. Ground-truth validation requires a calibration card and controlled test environment.

**Priority 5 — Auth and cloud persistence:**
Current state is ephemeral (browser session only). Production requires user accounts (Apple Sign In or magic link), server-side garden profile storage in PostgreSQL, and session management.

## Final Rubric Alignment Pass

Before final submission, I reviewed the project against the full Project 3 rubric. The main focus was confirming that JarDIYn is not just a prompt-response chatbot, but an agentic AI system where the model decides whether to use tools.

Confirmed evidence:

- The project defines seven JarDIYn tools with names, descriptions, and input schemas.
- The backend exposes the tools to Claude.
- Claude can decide to call tools.
- Claude can decide not to call a tool when a direct answer is enough.
- Claude can chain multiple tools across rounds.
- The backend executes selected tools and returns the result.
- The final answer uses tool results.
- The evaluation suite tests tool definition, tool execution, and agentic behavior.
- The project includes deployment configuration, prompt logs, build logs, and final documentation.

The most important evaluation proof is the contrast between PS-02 and PS-07. PS-02 proves the model can choose no tool, while PS-07 proves the model can chain multiple tools. This directly addresses the instructor feedback that the final project must show model-decided behavior rather than hardcoded routing.

## Final Live API + Agentic Tool Proof

The deployed Render app was verified at:

https://fluffy-lamp-fp3r.onrender.com

Live API test performed:

Prompt:

"I do not know my zone yet but my ZIP is 90210. What vegetables should I grow?"

Live response evidence:

- The deployed `/api/chat` endpoint returned a successful garden recommendation.
- Claude selected `get_garden_zone`.
- Claude selected `get_soil_data`.
- Claude then selected `lookup_plant_database`.
- The backend executed the selected tools.
- The model completed the response after three rounds.
- The response included grounded zone, frost, rainfall, soil, and vegetable recommendation context.

Trace evidence:

- Round 1: `tool_use` for `get_garden_zone` and `get_soil_data`
- Round 2: `tool_use` for `lookup_plant_database`
- Round 3: `end_turn` final answer

This confirms the deployed application is not only a static frontend and not only a one-shot prompt-response app. The live system uses the backend API, Claude reasoning, model-decided tool calls, backend tool execution, returned tool results, and a final model-generated response.
