/**
 * JarDIYn — Agentic Loop
 * =======================
 * Requirements 6 + 7: The model autonomously decides which tool to call
 * (or whether to call any tool at all). This file contains ZERO routing
 * logic — no if/switch that pre-selects a tool based on user input.
 *
 * Decision flow:
 *   1. We call Claude with the garden profile + JARDIYN_TOOLS definitions
 *   2. Claude reads the user message and tool descriptions
 *   3. Claude decides autonomously:
 *        a. Call one or more tools  → we execute them, loop back
 *        b. Call no tools           → we return the response directly
 *        c. Call tools, get results, stop → we return the final answer
 *   4. We never tell Claude which tool to call. It decides.
 *
 * The only application-level decision this file makes is WHEN TO STOP
 * looping — and even that is driven by Claude's stop_reason ("end_turn"
 * vs "tool_use"), not by our code reading the user's message.
 */

import Anthropic from "@anthropic-ai/sdk";
import { JARDIYN_TOOLS } from "./tools.js";
import { dispatchTool } from "./toolHandlers.js";

const anthropic = new Anthropic();
// Note: API key is read from ANTHROPIC_API_KEY env variable automatically.
// Never hardcode keys. See .env.example.

const MAX_TOOL_ROUNDS = 5; // Safety ceiling — prevents infinite loops

/**
 * buildSystemPrompt
 * -----------------
 * Gives Claude the garden context it needs to make good autonomous
 * tool-call decisions. The prompt intentionally does NOT say "call
 * tool X for Y questions" — that would move the decision into our
 * code. Instead, the tool descriptions themselves carry that logic.
 */
function buildSystemPrompt(gardenProfile) {
  const profileBlock = gardenProfile
    ? `
## Active Garden Profile
- Site: ${gardenProfile.site_name || "unnamed garden"}
- Zone: ${gardenProfile.hardiness_zone || "unknown"}
- ZIP Code: ${gardenProfile.zip_code || "not set — ask the user for their ZIP so you can look up their zone"}
- Soil: ${gardenProfile.soil_type || "unknown — use get_soil_data to look up"}
- Sun: ${gardenProfile.sun_exposure || "not specified"}
- Goals: ${(gardenProfile.goals || []).join(", ") || "not specified"}
- Plants: ${(gardenProfile.plant_inventory || []).map(p => p.common_name).join(", ") || "none recorded"}
- Experience: ${gardenProfile.experience_level || "unspecified"}
- Budget: ${gardenProfile.budget || "unspecified"}
- Maintenance tolerance: ${gardenProfile.maintenance_tolerance || "unspecified"}
- Water access: ${gardenProfile.water_access || "garden hose assumed"}
- Drainage: ${gardenProfile.drainage || "unknown — ask if relevant"}
- Pest pressure: ${gardenProfile.pest_pressure || "unspecified"}
- Known problems: ${gardenProfile.known_problems || "none reported"}
- Past failures: ${gardenProfile.past_failures || "none reported"}
`
    : "\n## Active Garden Profile\nNo profile loaded. Ask the user for their zip code or location to look up zone and soil data.\n";

  return `You are JarDIYn, a knowledgeable and trustworthy garden intelligence assistant by GardenHub.
You help homeowners and garden enthusiasts plan, diagnose, and care for their outdoor spaces.

${profileBlock}

## How to use your tools
You have access to tools that fetch real garden data. Use them when they would give the user
a better, more grounded answer than you could provide from general knowledge alone.

You decide whether to call a tool, which tool to call, and whether to call multiple tools
in sequence. The tool descriptions explain when each is appropriate.

Do not call a tool if you already have the information needed to answer well.
Do not call a tool just because one exists — only when it adds value.

## Trust and safety rules
- Always label depth or spatial estimates as "estimated — not a measured value"
- Never make autonomous irrigation control decisions — only recommendations
- Flag any plant identification below 0.6 confidence for human review
- Do not share GPS coordinates or EXIF data in your responses
- Cite data sources when providing specific soil, zone, or plant information

## Response style — JarDIYn voice
Claude is the reasoning engine. JarDIYn is the brand.

DO: Lead with garden context (location · zone · conditions). Use structured next
actions. Be calm, specific, local, direct. Concise by default, detailed when asked.

DO NOT: Open with "Great news", "Hi friend", "I'd love to help", "Of course!",
"Happy to help", or any mascot/lifestyle-app language. No emoji clutter. No apologies.
Personalize around the garden profile — zone, soil, sun, plants — not the user's identity.

PREFERRED SHAPE for planning and diagnostic questions:
[City] · Zone [X] · [Sun condition]

This week / Today / Right now:
- [specific action]
- [specific action]

Why now: [one line]
Next: [one watch item or follow-up]`;
}

/**
 * runGardenAgent
 * --------------
 * The core agentic loop. Sends a message to Claude, handles any tool
 * calls the model decides to make, and returns the final response.
 *
 * @param {string|Array} userMessage - The user's message (string or content array for images)
 * @param {object} gardenProfile     - The user's GardenProfile (may be partial or null)
 * @param {Array}  conversationHistory - Prior messages for multi-turn context
 * @param {object} options           - { traceLog: boolean, sessionId: string }
 * @returns {object} { response: string, toolsUsed: string[], trace: Array, rounds: number }
 */
export async function runGardenAgent(
  userMessage,
  gardenProfile = null,
  conversationHistory = [],
  options = {}
) {
  const { traceLog = false, sessionId = crypto.randomUUID() } = options;
  const trace = [];                  // Full execution trace (for evaluation)
  const toolsUsed = [];              // Which tools the model chose to call
  let rounds = 0;

  // Build the message thread: history + new user message
  const messages = [
    ...conversationHistory,
    { role: "user", content: userMessage }
  ];

  if (traceLog) {
    console.log(`\n[agent:start] session=${sessionId}`);
    console.log(`[agent] user message: "${typeof userMessage === "string" ? userMessage.slice(0, 100) : "[content array]"}"`);
  }

  // ── Agentic loop ──────────────────────────────────────────────────────────
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    if (traceLog) console.log(`\n[agent:round ${rounds}] calling Claude...`);

    // ── Step 1: Call Claude with tool definitions ─────────────────────────
    // This is where Requirement 5 is satisfied: JARDIYN_TOOLS passed in `tools`
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,               // Headroom for full reports without truncation
      system: buildSystemPrompt(gardenProfile),
      tools: JARDIYN_TOOLS,           // REQ 5: formal tool definitions exposed to model
      messages
    });

    trace.push({
      round: rounds,
      stop_reason: response.stop_reason,
      model:       response.model,
      message_id:  response.id,
      usage:       response.usage,   // { input_tokens, output_tokens, cache_read_input_tokens }
      content_blocks: response.content.map(b => ({
        type: b.type,
        ...(b.type === "text"     ? { text: b.text.slice(0, 200) } : {}),
        ...(b.type === "tool_use" ? { name: b.name, input: b.input } : {})
      }))
    });

    if (traceLog) {
      console.log(`[agent:round ${rounds}] stop_reason="${response.stop_reason}"`);
      response.content.forEach(b => {
        if (b.type === "tool_use") console.log(`  → model chose tool: ${b.name}`, b.input);
        if (b.type === "text")     console.log(`  → model text: "${b.text.slice(0, 120)}"`);
      });
    }

    // ── Step 2: REQ 7 — Model decides to stop ────────────────────────────
    // If stop_reason is "end_turn", the model chose NOT to call any more
    // tools. We extract the text response and exit.
    if (response.stop_reason === "end_turn") {
      const finalText = response.content
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("\n");

      if (traceLog) console.log(`[agent:done] finished in ${rounds} round(s). Tools used: [${toolsUsed.join(", ")}]`);

      return {
        response: finalText,
        toolsUsed,
        trace,
        rounds,
        sessionId
      };
    }

    // ── Step 3: REQ 6 + 7 — Model decided to call tool(s) ────────────────
    // We execute whatever tool(s) the model chose — our code does NOT pick
    // the tool. We only dispatch what the model's response specifies.
    if (response.stop_reason === "tool_use") {
      // Append the assistant's turn (which includes tool_use blocks)
      messages.push({ role: "assistant", content: response.content });

      // Execute each tool the model requested (may be multiple in one round)
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        if (traceLog) console.log(`[agent] executing tool: ${block.name}`);

        // REQ 6: Dispatch to handler — model's choice, our execution
        const result = await dispatchTool(block.name, block.input);
        toolsUsed.push(block.name);

        // Capture provenance for frontend trace display
        const mode   = result?.mode || result?.provenance?.mode || "unknown";
        const source = result?.source || result?.provenance?.source || null;

        // Subatomic: strip large arrays/text but keep key scalar fields
        const subatomic = {};
        if (result && typeof result === "object") {
          for (const [k, v] of Object.entries(result)) {
            if (k === "mode" || k === "source" || k === "tool") continue;
            if (typeof v === "string"  && v.length  > 120) { subatomic[k] = v.slice(0, 120) + "…"; continue; }
            if (Array.isArray(v))                           { subatomic[k] = `[${v.length} items]`;  continue; }
            if (typeof v === "object" && v !== null)        { subatomic[k] = JSON.stringify(v).slice(0, 120); continue; }
            subatomic[k] = v;
          }
        }

        trace.push({
          step: "tool_execution",
          tool: block.name,
          mode,
          source,
          ok: !result?.error,
          subatomic   // the actual data Claude read from this tool
        });

        // REQ 6: Return tool_result back to the model
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,            // Must match the tool_use block's id
          content: JSON.stringify(result)    // Serialized result the model will read
        });
      }

      // Append tool results — model will read these in the next round
      // and again decide autonomously: call more tools, or stop (REQ 7)
      messages.push({ role: "user", content: toolResults });

      // Loop continues — back to Step 1
      continue;
    }

    // ── Step 4: Any other stop_reason (max_tokens, pause_turn, etc.) ──────
    // The response was truncated or stopped for a non-tool reason. Return
    // whatever text we have rather than silently looping and burning rounds.
    {
      const partialText = response.content
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("\n");

      if (traceLog) console.log(`[agent:done] stopped on "${response.stop_reason}" after ${rounds} round(s).`);

      return {
        response: partialText || "I wasn't able to complete that response. Please try rephrasing your question.",
        toolsUsed,
        trace,
        rounds,
        sessionId,
        stop_reason: response.stop_reason
      };
    }
  }

  // Safety: if we hit MAX_TOOL_ROUNDS, return what we have
  console.warn(`[agent:warn] hit MAX_TOOL_ROUNDS (${MAX_TOOL_ROUNDS}) — returning partial response`);
  return {
    response: "I reached my tool call limit for this request. Please try a more specific question.",
    toolsUsed,
    trace,
    rounds,
    sessionId,
    warning: "max_rounds_exceeded"
  };
}

/**
 * runChatTurn
 * -----------
 * Convenience wrapper for the /api/chat endpoint.
 * Maintains conversation history across turns.
 */
export async function runChatTurn(userMessage, gardenProfile, history = []) {
  const result = await runGardenAgent(userMessage, gardenProfile, history, { traceLog: true });
  // Caller appends user + assistant messages to history for next turn
  return result;
}
