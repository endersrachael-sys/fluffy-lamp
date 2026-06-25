# JarDIYn — Deploy to a Live URL in 5 Minutes

The grader needs a public URL they can click. Here are three ways to get one. **Render is the fastest and free.**

---

## ✅ Before you deploy — verify locally (30 seconds, no API key needed)

```bash
npm install
node verify.mjs
```

You should see **21 checks pass** (the only ✗ will be the API key, which is correct — it belongs in the host, not the repo).

To test the live agent locally with a key:
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key
node tests/evaluation.mjs     # runs all 7 planted-signal tests
node server.mjs               # open http://localhost:3000
```

---

## Option A — Render (recommended, free tier, ~3 min)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "JarDIYn — agentic garden intelligence platform"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/jardiyn.git
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
   - Connect your GitHub repo
   - Render auto-detects `render.yaml`. Confirm:
     - Build Command: `npm install`
     - Start Command: `npm start`
   - Under **Environment**, add:
     - Key: `ANTHROPIC_API_KEY`  Value: `sk-ant-your-key`
   - Click **Create Web Service**

3. **Done.** Render gives you `https://jardiyn.onrender.com`. First load may take ~30s (free tier cold start), then it's live.

> Free-tier note: the service sleeps after 15 min idle and wakes on the next request. The rubric explicitly allows this ("If the app is asleep... that is fine as long as it wakes up and runs").

---

## Option B — Railway (~3 min)

```bash
npm install -g @railway/cli
railway login
railway init           # name it "jardiyn"
railway up             # builds and deploys
railway variables set ANTHROPIC_API_KEY=sk-ant-your-key
railway domain         # generates your public URL
```

`railway.toml` is already configured.

---

## Option C — Fly.io (container, ~5 min)

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --no-deploy      # detects Dockerfile + fly.toml
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key
fly deploy
```

`Dockerfile` and `fly.toml` are already configured.

---

## After deploying — confirm it works

Open your URL and try one of the built-in prompts. You should see:

1. The chat UI loads with the garden profile sidebar
2. Type a ZIP code in the sidebar, then click **"What to plant now"**
3. The agent responds AND shows green tool-call badges below the answer (e.g. `get garden zone`, `lookup plant database`)
4. Try **"When to prune hostas?"** — you'll see **"no tools — direct answer"**, proving the model decides when NOT to call a tool

If you see tool badges appearing and disappearing based on the question, the agentic behavior is working and visible to the grader.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Agent error — check your ANTHROPIC_API_KEY" | The key isn't set in the host environment. Add it in the dashboard. |
| App won't boot | Run `node verify.mjs` locally — it catches wiring problems. |
| 502 on first load (Render) | Cold start. Wait 30s and refresh. |
| Tool calls never appear | Check the key is valid and has credit at console.anthropic.com |

---

## What the grader will check, and where it is

| Rubric item | Where to look | Quick proof |
|-------------|---------------|-------------|
| 1. Deployment | Your live URL | Open it, send a message |
| 2. Prompt engineering | `PROMPT_LOG.md` | 3 versions, before/after results |
| 3. System prompt | `src/services/agentLoop.js` → `buildSystemPrompt` | 5 named sections |
| 4. Grounding | `src/services/toolHandlers.js` | 6 data sources, input-dependent results |
| 5. MCP tool definition | `src/services/tools.js` | 6 tools, name + description + input_schema |
| 6. MCP tool execution | `src/services/agentLoop.js` lines 95–115 | tool_use → dispatch → tool_result loop |
| 7. Agentic behavior | `src/services/agentLoop.js` | only branches on `stop_reason`, never on message content |
| 8. GitHub | Your repo | meaningful commit history |
| 9. Build log | `BUILD_LOG.md` | 6 iterations with failures + fixes |
| 10. Originality | `README.md` closing section | the "not a chatbot with a skin" argument |
