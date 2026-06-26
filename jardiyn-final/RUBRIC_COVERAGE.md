# JarDIYn Final Project Rubric Coverage

## Project Summary

JarDIYn by GardenHub is an agentic AI garden intelligence assistant for home gardeners. It helps users make practical plant-care and planning decisions using Claude, custom JarDIYn tools, grounded garden context, and a deployed full-stack web application.

The system is designed around a real user problem: beginner and home gardeners often struggle to decide what to plant, when to water, how to interpret plant symptoms, and how local growing conditions should affect garden care.

## 1. Deployment

JarDIYn is designed to deploy as a public web application, not only localhost.

Deployment target:

- Render web service
- Root directory: `jardiyn-final`
- Build command: `npm install`
- Start command: `npm start`
- Required environment variable: `ANTHROPIC_API_KEY`

Final deployed URL:

`PASTE_RENDER_URL_HERE`

Health check:

`PASTE_RENDER_URL_HERE/api/health`

## 2. Prompt Engineering

The project includes deliberate prompt engineering through the JarDIYn agent behavior, tool descriptions, and prompt/build logs.

Prompt design goals:

- beginner-friendly garden advice
- practical next steps
- safe plant-care boundaries
- tool use when outside context is needed
- no overclaiming diagnosis certainty
- clear distinction between direct answers and tool-grounded answers

Prompt versions and changes are documented in:

- `PROMPT_LOG.md`
- `BUILD_LOG.md`
- `README.md`

## 3. System Prompt

The system prompt defines JarDIYn as a garden intelligence assistant and shapes its behavior, scope, and constraints.

It establishes that the assistant should:

- act as a practical garden assistant
- use available tools when needed
- avoid unsupported certainty
- explain recommendations clearly
- produce beginner-friendly outputs
- respect the tool-use loop

Important file:

- `src/services/agentLoop.js`

## 4. Grounding

JarDIYn is grounded because Claude receives structured context from custom tools instead of relying only on pretraining.

Grounding sources include:

- garden zone lookup
- soil data
- weather forecast
- frost alerts
- plant database lookup
- plant symptom identification
- garden report generation

The model is given information that depends on user inputs such as ZIP code, latitude/longitude, plant symptoms, zone, and garden goals.

## 5. MCP Tool Definition

The project defines custom tools with:

- name
- description
- input schema

Tool definition file:

- `src/services/tools.js`

Defined tools include:

- `identify_plant`
- `get_garden_zone`
- `get_soil_data`
- `get_weather_forecast`
- `generate_diy_report`
- `lookup_plant_database`
- `get_frost_alerts`

## 6. MCP Tool Execution

The model can call tools during real interactions. The backend reads model tool-use blocks, dispatches the selected tool to a handler, executes it, and returns the tool result to the model.

Important files:

- `src/services/agentLoop.js`
- `src/services/toolHandlers.js`
- `tests/evaluation.mjs`

The evaluation confirms the tool-use loop:

- model chooses a tool
- backend executes the selected tool
- tool result is returned
- model generates a final answer using the result

## 7. Agentic Behavior

JarDIYn is agentic because Claude makes autonomous decisions during execution.

The model decides:

- whether to call a tool
- which tool to call
- whether no tool is needed
- whether to chain multiple tools
- when to stop and produce the final answer

The evaluation proves this with:

- PS-02: no tool call for a direct hosta-pruning question
- PS-07: chained tool use for zone lookup, soil data, and plant lookup

This proves the behavior is not just if/else routing in the application layer.

## 8. Code on GitHub

The code lives in a public GitHub repository:

https://github.com/endersrachael-sys/fluffy-lamp

Main project folder:

`jardiyn-final/`

## 9. Build Log

The project includes build and prompt documentation showing what changed over time.

Important files:

- `BUILD_LOG.md`
- `PROMPT_LOG.md`
- `README.md`
- `RUBRIC_COVERAGE.md`

The build log should document:

- earlier mock-mode limitations
- missing environment configuration
- deployment fixes
- prompt changes
- tool-loop verification
- final evaluation results

## 10. Originality

JarDIYn is not a generic chatbot. It is a domain-specific garden intelligence assistant focused on practical home-gardening decisions.

Its distinctive angle is combining:

- garden advice
- spatial/growing context
- plant symptoms
- zone data
- soil/weather/frost context
- model-decided tool use
- export/report style planning

## 11. Intellectual Ownership

The project demonstrates intellectual ownership because the architecture, documentation, tests, and logs explain what the system does, why it works, and where it is limited.

Known limitations are documented rather than hidden:

- some handlers use sandbox/fallback data
- live third-party APIs can fail or rate-limit
- the assistant does not replace professional horticulture, pesticide, or disease diagnosis
- deployment requires a valid Anthropic API key

## 12. Iteration

The final version addresses the main weakness from the draft: earlier versions relied too much on mock or deterministic behavior.

Final improvements include:

- live Claude API connection
- model-decided tool use
- custom tool definitions
- backend tool execution
- chained tool evaluation
- no-tool decision proof
- safe environment configuration
- deployment readiness checks
- structured evaluation tests

## 13. Evaluation

The project defines success as safe, clear, beginner-friendly, grounded garden advice that helps a real user make a practical decision.

Evaluation includes structured test cases for:

- autonomous zone lookup
- direct answer without tool use
- symptom-based plant identification
- weather-based watering guidance
- report generation
- plant database lookup
- multi-step tool chaining

Final evaluation target:

`24 passed, 0 failed`

## 14. Documentation

The project documentation explains:

- what the system does
- who it is for
- how the architecture works
- how tools are defined and executed
- how to run locally
- how to deploy
- how to evaluate
- what the system does not do

Important documentation files:

- `README.md`
- `DEPLOY.md`
- `BUILD_LOG.md`
- `PROMPT_LOG.md`
- `RUBRIC_COVERAGE.md`
- `FINAL_SUBMISSION.md`
