# JarDIYn — Integration Strategy & Recommendations

What's wired now, what I recommend adding, and — just as important — what I recommend **against** adding. This reflects a full understanding of the project: a free-to-deploy garden intelligence capstone that must stay credible, not sprawl.

---

## ✅ Wired now — live, free, no API key

These three are integrated and active in production (`LIVE_APIS=true`). They were chosen because they need no signup, no key, no cost, and no rate-limit risk for a capstone demo.

| Tool | Live API | Why this one |
|------|----------|--------------|
| `get_garden_zone` | **phzmapi.org** | Free USDA Plant Hardiness Zone by ZIP. No key. The canonical US zone source. |
| `get_weather_forecast` | **Open-Meteo** | NOAA GFS-backed, no key, generous limits. Chosen over OpenWeatherMap *specifically because it needs no key* — one less thing for a grader to configure. |
| `get_soil_data` | **SoilGrids (ISRIC)** | Free global soil chemistry (pH, clay/sand/silt, organic carbon) by lat/lng. No key. |

Plus a **geocoding helper** (Open-Meteo geocoding) so a ZIP code resolves to coordinates for the soil and weather calls.

**Resilience built in:** every live call falls back to the mock automatically if the API is down, times out, or returns an unexpected shape. The app never crashes because of an upstream outage.

---

## ⭐ Recommended next — high fit, low friction

If you take this past the capstone, these are the additions I'd prioritize, in order.

### 1. NOAA / NWS for frost & freeze alerts — **STRONG FIT**
**api.weather.gov** (US National Weather Service) — no key, government source.

Why it matters for gardens specifically: Open-Meteo gives you a forecast, but NWS issues **official frost/freeze warnings and advisories** — the exact alerts a gardener needs ("freeze warning tonight, protect tender plants"). This is more actionable than raw temperature for the watering/protection use case.

- Endpoint: `GET api.weather.gov/points/{lat},{lng}` → grid → `/forecast` + active alerts
- Adds a new tool: `get_frost_alerts(lat, lng)` → active NWS warnings
- Pairs perfectly with the existing watering logic

### 2. Plant.id for real photo identification — **STRONG FIT**
**api.plant.id/v3** — the `identify_plant` tool currently takes a text symptom description. Plant.id adds real **image-based** plant and disease identification.

- Needs a free-trial API key (the one paid dependency, but generous trial)
- The agentic loop and frontend already support image upload (the `/api/identify` endpoint accepts `image_base64`)
- This is the single biggest capability jump — text symptoms → actual photo diagnosis

### 3. Perenual or Trefle plant database — **GOOD FIT**
The `lookup_plant_database` tool uses a curated in-code list of ~6 plants. A real database makes recommendations comprehensive.

- **Perenual** (perenual.com/docs/api): free tier, 10k+ plants, care guides, watering/sun data — best fit, modern API
- **Trefle** (trefle.io): larger botanical DB but signup is slower
- Recommend Perenual for the cleaner free tier

### 4. OpenEPI or USDA SSURGO for richer soil — **MODERATE FIT**
SoilGrids gives global chemistry. For US users, **USDA SSURGO** (via Soil Data Access) gives named soil series and survey-grade local data — more authoritative, but the API is SQL-over-REST and more complex. Worth it only if US-specific soil accuracy becomes a priority.

---

## 🔌 MCP servers worth considering — for the agentic story

If you want to lean into the MCP angle beyond the tool definitions already in the project:

| MCP Server | Use case | Fit |
|------------|----------|-----|
| **Filesystem MCP** | Let the agent save/load garden reports and history to disk | Good — matches the proposal's "save/upload" feature |
| **Google Drive MCP** | Export reports and design plans to the user's Drive | Good — the proposal explicitly mentions "upload to your computer" |
| **Memory / SQLite MCP** | Persist garden profiles and conversation history across sessions | Strong — solves the current "resets on refresh" limitation |
| **Brave Search / Fetch MCP** | Let the agent look up plant-specific growing guides on demand | Moderate — useful but adds hallucination surface |

The **Memory/SQLite MCP** is the one I'd actually add next — it directly fixes the biggest current limitation (no persistence) and strengthens the "garden history is the moat" thesis from the proposal.

---

## 🚫 Deliberately NOT recommended — and why

A gold-standard project shows judgment by what it *excludes*. These were in the original brainstorm but should stay out:

| Tool/API | Why NOT |
|----------|---------|
| **SmartThings / sprinkler control** | Liability. Autonomous irrigation control creates a safety and legal surface no capstone should carry. The risk register flags this as mock-only, manual-confirmation-required. Keep it a recommendation, never a live action. |
| **ARKit / DepthLab / 3D reconstruction** | Cannot be validated without ground-truth depth testing. Claiming spatial accuracy you haven't measured is the exact overclaiming the v18/v19 reviews warned against. Feature-flag it; don't ship it live. |
| **Revit / CAD/BIM export** | Massive integration effort for a feature few users reach. Roadmap-only until there's a professional pilot. |
| **Twilio / SMS notifications** | Adds cost, phone-number PII, and compliance (TCPA) burden. Push notifications via the native app are the right channel, later. |
| **Real-time multiplayer / social feed** | Moderation burden. Private crews first, public never (at capstone scale). |

---

## The principle behind these choices

Every integration was judged on four axes:

1. **Does it need a key or cost?** Free + no-key wins for a deployable capstone.
2. **Does it add real grounding the model lacks?** Live zone/soil/weather data the model can't know from training.
3. **Does it carry safety or liability risk?** Irrigation control and unvalidated depth claims do — they stay out.
4. **Does it fit the actual user job?** A gardener needs frost alerts and plant ID more than CAD export.

The three live APIs wired now hit all four: free, real grounding, zero risk, core to the job. The recommended additions extend that. The excluded ones fail axis 3 or 4.
