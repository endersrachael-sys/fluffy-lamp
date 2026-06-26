# Project 3 Final Submission: JarDIYn by GardenHub

## Deployed Application

PASTE_RENDER_URL_HERE

## Backend Health Check

PASTE_RENDER_URL_HERE/api/health

## GitHub Repository

https://github.com/endersrachael-sys/fluffy-lamp

## Project Folder

`jardiyn-final/`

## Project Overview

JarDIYn is an agentic AI garden intelligence assistant for home gardeners. It helps users make practical plant-care and planning decisions using Claude, custom JarDIYn tools, grounded garden context, and a deployed full-stack web application.

The project solves a real-world problem: beginner and home gardeners often struggle to decide what to plant, when to water, how to interpret plant symptoms, and how zone, soil, weather, and frost conditions should affect care decisions.

## Architecture

JarDIYn includes:

- browser frontend
- Node/Express backend
- Claude API integration
- custom JarDIYn tool definitions
- backend tool handlers
- SQLite persistence
- Render deployment configuration
- Dockerfile
- structured evaluation suite
- prompt and build logs

Important files:

- `server.mjs`
- `src/services/agentLoop.js`
- `src/services/tools.js`
- `src/services/toolHandlers.js`
- `tests/evaluation.mjs`
- `README.md`
- `BUILD_LOG.md`
- `PROMPT_LOG.md`
- `RUBRIC_COVERAGE.md`

## What Is Agentic

JarDIYn is agentic because Claude receives the user request and the available JarDIYn tools, then decides what to do next. The model can decide to call a tool, call no tool, or chain multiple tools.

The backend does not simply route requests through hardcoded if/else logic. The backend provides tool definitions and an execution loop. Claude is the decision-maker.

Evaluation proof:

- PS-02 proves Claude can decide not to call a tool.
- PS-07 proves Claude can chain multiple tools across rounds.
- Req 5 confirms tool definitions are included.
- Req 6 confirms the tool-use to tool-result execution loop.
- Req 7 confirms agentic behavior.

## MCP / Tool Evidence

The project defines seven JarDIYn tools with names, descriptions, and input schemas:

- `identify_plant`
- `get_garden_zone`
- `get_soil_data`
- `get_weather_forecast`
- `generate_diy_report`
- `lookup_plant_database`
- `get_frost_alerts`

These tools are exposed to the model, selected by the model, executed by the backend, and returned to the model as tool results.

## Grounding

JarDIYn grounds responses using structured tool context such as:

- ZIP-code based garden zone lookup
- soil data
- weather context
- frost alert context
- plant database lookup
- plant symptom identification
- garden report generation

This gives the model information beyond its general training data.

## Evaluation

I defined a successful JarDIYn response as one that is safe, clear, beginner-friendly, grounded in the user’s context, and useful for a real gardening decision.

The evaluation suite tests:

- autonomous zone lookup
- direct answers without tool calls
- symptom-based plant identification
- weather-based watering guidance
- report generation
- plant database lookup
- multi-step tool chaining

Final local evaluation target:

`24 passed, 0 failed`

## Iteration

The final project addresses the main gap from the draft version: earlier versions were too close to mock or deterministic behavior. The final version adds live Claude reasoning, model-decided tool use, chained tool execution, no-tool decision proof, deployment safety checks, and structured evaluation.

## Known Limitations

Some data handlers use sandbox or fallback data where live third-party APIs are not connected. This is documented honestly. Future versions could connect additional live APIs for USDA soil, weather, plant identification, mapping, saved garden profiles, and PDF reporting.

JarDIYn does not replace professional horticulture, pesticide safety guidance, plant pathology diagnosis, or legal/environmental compliance advice.

## Final Submission Links

Deployed app: PASTE_RENDER_URL_HERE  
Health check: PASTE_RENDER_URL_HERE/api/health  
GitHub repo: https://github.com/endersrachael-sys/fluffy-lamp  
Project folder: `jardiyn-final/`
