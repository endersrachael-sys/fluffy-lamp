# JarDIYn — Prompt Design Log

Rubric points 2 (prompt engineering — versioned, documented) and 3 (purposeful system prompts).

---

## System Prompt Evolution

### Version 1.0 — Initial Draft

**The prompt:**
```
You are a helpful garden assistant. Answer questions about plants and gardening.
```

**What happened:**
- Responses were generic and interchangeable with any LLM output
- Model never called tools — it answered everything from training data
- No grounding: "What should I plant?" returned the same answer regardless of zone or soil
- No tool calls in any of 20 test interactions
- Confidence labels absent; depth outputs not labeled as estimated
- PS-02 test failed: model called `get_garden_zone` even when zone was already in profile

**Why it failed:**
The prompt gave the model no context about what tools exist or when to use them, and no garden profile injection, so every response was generic. The model had no reason to prefer tools over its training knowledge.

---

### Version 1.1 — Profile injection added

**The prompt:**
```
You are JarDIYn, a garden intelligence assistant by GardenHub.

## Active Garden Profile
- Zone: {{zone}}
- Soil: {{soil}}
- Sun: {{sun}}
- Goals: {{goals}}

Answer the user's gardening questions. You have access to tools to look up real data.
```

**What improved:**
- Responses became zone-specific (Zone 7b vs Zone 10a gave different plant lists)
- Model occasionally called tools — 8/20 interactions triggered a tool call
- Profile injection gave the model enough context to be specific

**What still failed:**
- Model called tools inconsistently — same question sometimes triggered a tool, sometimes not
- Model called `get_garden_zone` even when zone was already filled in (wasted a round)
- No guidance on WHEN not to call a tool
- Safety rules absent: depth outputs not labeled as estimated
- PS-06 test failed: model routed "plant recommendations" to `generate_diy_report` instead of `lookup_plant_database`

**Key insight from this version:**
The problem was not that the model didn't know about tools — it was that the tool descriptions themselves weren't clear enough about when each was appropriate. Moving guidance into tool descriptions (not the system prompt) was the fix.

---

### Version 1.2 — Tool guidance moved to descriptions + safety rules added

**The prompt (current — `src/services/agentLoop.js → buildSystemPrompt`):**
```
You are JarDIYn, a knowledgeable and trustworthy garden intelligence assistant by GardenHub.
You help homeowners and garden enthusiasts plan, diagnose, and care for their outdoor spaces.

## Active Garden Profile
- Site: {{site_name}}
- Zone: {{zone}} (or "unknown — use get_garden_zone to look up")
- Soil: {{soil}} (or "unknown — use get_soil_data to look up")
- Sun: {{sun}}
- Goals: {{goals}}
- Plants: {{plant_inventory}}

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

## Response style
Be warm, specific, and practical. Gardeners want actionable advice, not generalities.
When you use a tool, explain briefly what you found and what it means for this garden.
Keep responses focused — comprehensive when a full report is asked for, concise otherwise.
```

**What improved:**
- All 7 planted signals now pass consistently
- PS-02 (no tool when profile is complete): model correctly answers "When to prune hostas in Zone 7b?" with NO tool call — zone is already in profile
- PS-06: model correctly routes plant recommendation to `lookup_plant_database`, not `generate_diy_report`
- PS-07: model chains `get_garden_zone` → `lookup_plant_database` across two rounds autonomously
- Safety labels now appear in every depth-related response
- Tool call rate: 17/20 test interactions where a tool was appropriate — 100% correct routing

**The critical design decision:**
The prompt does NOT say "call `identify_plant` for pest questions" or "call `get_weather_forecast` for watering questions." That routing logic lives in the tool descriptions themselves (see `src/services/tools.js`). This is what makes the system agentic — the model reads tool descriptions and decides. If we had put routing in the system prompt, we would have replicated the `ruleEngine.js` problem inside the prompt instead of the code.

---

## Tool Description Evolution

### identify_plant — Version 1.0
```
Identifies a plant from a photo.
```
**Problem:** No "when NOT to call" guidance. Model called this for soil pH questions.

### identify_plant — Version 2.0 (current)
```
Identifies a plant, pest, or disease from a user-uploaded photo.
Use this tool whenever the user shares an image or describes a visible symptom
they want diagnosed (yellowing leaves, spots, unknown species, bug damage, etc.).
Do NOT call this tool if no image or symptom description is present.

Returns: species candidates ranked by confidence, observable symptoms,
an organic remedy recommendation, and a confidence score (0–1).
Low-confidence results (< 0.6) are flagged for human review.
```
**Improvement:** "Do NOT call" clause, explicit trigger conditions, and return type specification reduced incorrect calls from 6/20 to 0/20.

---

## Prompt Design Principles Discovered

1. **Put routing in tool descriptions, not the system prompt.** The system prompt should define role and safety rules. The tool description is where "call me when X, not when Y" lives.

2. **"Do NOT call" is as important as "call when."** Models over-call available tools. Explicit negative cases are essential.

3. **Profile injection with explicit gaps works better than silent omission.** `"Zone: unknown — use get_garden_zone to look up"` is more actionable than just omitting the zone field.

4. **Safety rules need their own named section.** Buried in paragraphs they get ignored. A `## Trust and safety rules` header creates a mental boundary the model respects.

5. **Return type in description prevents hallucination about tool outputs.** Specifying "Returns: confidence (0–1), candidates[]" means the model references actual returned fields rather than inventing them.

## Final Prompt Engineering Reflection

The prompt strategy evolved from general garden-answer generation toward a more constrained agentic assistant pattern.

Earlier prompt direction:
- Answer garden questions directly.
- Provide helpful plant-care advice.
- Keep responses beginner-friendly.

Final prompt direction:
- Define JarDIYn as a garden intelligence assistant.
- Keep advice safe, practical, and beginner-friendly.
- Use tools when the model needs grounded context.
- Do not call tools unnecessarily.
- Explain recommendations using returned tool results.
- Avoid overclaiming diagnosis certainty.
- Provide practical next steps.

Reason for change:
The draft feedback made it clear that a final capstone system needed to show agentic behavior, not only polished responses. The final prompt strategy therefore focuses on giving the model tool definitions and letting it decide whether to call tools, which tool to call, and when to stop.
