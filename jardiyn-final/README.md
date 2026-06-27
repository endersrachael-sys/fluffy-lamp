# JarDIYn by GardenHub

Professional garden intelligence translated for real backyards.

## Local run

```bash
npm install
FORCE_FALLBACK_AGENT=true npm test
FORCE_FALLBACK_AGENT=true npm start
```

Open port 3000.

## API

- `GET /api/health`
- `GET /api/status`
- `GET /api/tools`
- `GET /api/sources`
- `GET /api/evaluation`
- `POST /api/chat`
- `POST /api/garden-profile`
- `GET /api/garden/:sessionId`
- `POST /api/plants/:sessionId`
- `POST /api/tasks/:sessionId/:taskId/complete`

## Modes

Sandbox/fallback mode works without an Anthropic key.
Live LLM mode is used only when `ANTHROPIC_API_KEY` is set and `FORCE_FALLBACK_AGENT` is not true.
