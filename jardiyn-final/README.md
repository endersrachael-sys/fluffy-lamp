# JarDIYn by GardenHub

**Outdoor confidence platform:** professional garden intelligence translated into realistic backyard action.

JarDIYn helps users understand their actual yard, avoid costly planting mistakes, check plans before buying plants, and generate practical Garden Plans from a Garden Passport.

## What is live in this rebuild

- Homeowner-first landing page
- Garden Passport saved in browser localStorage
- Optional server session memory for the current deployment process
- Demo Scenario Launcher with 10 scenarios and guided prompts
- Plan Check Mode
- Generate Garden Plan
- Agentic Claude tool loop when `ANTHROPIC_API_KEY` is configured
- Transparent fallback engine when no LLM key exists or LLM call fails
- Safe `/api/health`
- Sanitized debug mode at `?debug=true`
- `/api/tools`, `/api/sources`, `/api/evaluation`
- Evaluation tests via `npm test`

## What is not live yet

- User accounts
- Cloud-synced property records
- Payment
- Marketplace
- Municipal GIS upload
- Satellite/drone add-ons
- Professional review booking
- Public community feed

Those are roadmap features and must not be presented as live.

## Run locally

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

Debug view:

```text
http://localhost:3000/?debug=true
```

## Test

```bash
npm test
```

Smoke test after starting the server:

```bash
BASE_URL=http://localhost:3000 npm run smoke
```

## Render deployment

Use Render Web Service with:

- Root directory: `jardiyn-final`
- Build command: `npm install`
- Start command: `npm start`
- Environment variable: `ANTHROPIC_API_KEY` if using live Claude
- Optional environment variable: `ANTHROPIC_MODEL`

If Render auto-deploy is connected to `main`, pushing to `main` redeploys.

## Core thesis

Gardening does not lack inspiration. It lacks personalized follow-through.

JarDIYn turns:

> “I want that”

into:

> “Here is what will work here, what may fail, and what to do next.”

## Architecture

```text
Browser UI
  ↓
Garden Passport localStorage
  ↓
POST /api/chat
  ↓
runGardenAgent()
  ↓
Claude tool loop when configured
  ↓
dispatchTool()
  ↓
zone / soil / weather / plant / diagnosis / plan tools
  ↓
answer + sources + confidence + safe trace
```

## Safety posture

Public users see product value first. Technical details are hidden by default.

The debug panel is only shown with `?debug=true` and returns sanitized diagnostics only. It never exposes secrets, raw environment values, raw prompts, private property data, photos, stack traces, or API keys.

## Product roadmap

1. Brass MVP: Garden Passport, Plan Check, Garden Plan, trace, demo scenarios.
2. Trust layer: saved history, Garden Recovery Mode, local pilots, evaluation suite.
3. Accounts: cloud-synced properties, shared access, households, professionals.
4. Property Intelligence: municipal GIS import, public parcel layers, satellite/drone partner add-ons.
5. Marketplace/community: nursery lists, landscaper scopes, professional handoff reports, The Crew.
