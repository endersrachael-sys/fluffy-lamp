/**
 * JarDIYn — Live API Integrations
 * ================================
 * Real external API calls for the three zero-key, no-friction data sources:
 *   - USDA Plant Hardiness Zone   → phzmapi.org          (no key)
 *   - Weather forecast            → Open-Meteo (NOAA/GFS) (no key)
 *   - Soil properties             → SoilGrids / ISRIC     (no key)
 *
 * Design principle: EVERY live call is wrapped so that if the API is
 * down, rate-limited, times out, or returns an unexpected shape, the
 * handler falls back to the sandbox mock instead of crashing. The app
 * never breaks because an upstream API had a bad day.
 *
 * Toggle with env: LIVE_APIS=true enables live calls (default: mock-only
 * so the app boots and demos without any external dependency).
 */

const LIVE = process.env.LIVE_APIS === "true";
const TIMEOUT_MS = 6000;

// ── fetch with timeout ────────────────────────────────────────────────────
async function fetchJSON(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── WMO weather code → human conditions (Open-Meteo uses WMO codes) ───────
function wmoToConditions(code) {
  if (code === 0) return "clear";
  if (code <= 3) return "partly cloudy";
  if (code <= 48) return "foggy";
  if (code <= 67) return "rainy";
  if (code <= 77) return "snowy";
  if (code <= 82) return "rain showers";
  if (code <= 99) return "thunderstorm";
  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────
// LIVE: USDA Hardiness Zone via phzmapi.org
// Docs: https://phzmapi.org  ·  GET https://phzmapi.org/{zip}.json
// Returns: { zone: "7a", temperature_range: "0 to 5", coordinates: {...} }
// ─────────────────────────────────────────────────────────────────────────
export async function liveGardenZone(zip) {
  if (!LIVE || !zip) return null;
  try {
    const data = await fetchJSON(`https://phzmapi.org/${zip}.json`);
    if (!data?.zone) return null;

    // Derive frost dates from zone number (approximate — phzmapi gives zone only)
    const zoneNum = parseInt(String(data.zone).replace(/[ab]$/, ""), 10);
    const frostByZone = {
      3: { last: "05-15", first: "09-15" }, 4: { last: "05-10", first: "09-25" },
      5: { last: "04-30", first: "10-10" }, 6: { last: "04-20", first: "10-20" },
      7: { last: "04-05", first: "11-05" }, 8: { last: "03-15", first: "11-20" },
      9: { last: "02-15", first: "12-10" }, 10: { last: null,    first: null    },
      11:{ last: null,    first: null    }
    };
    const frost = frostByZone[zoneNum] || frostByZone[7];
    const year = new Date().getFullYear();

    return {
      tool: "get_garden_zone",
      source: "phzmapi.org (USDA PHZM)",
      mode: "live",
      hardiness_zone: data.zone,
      temperature_range_f: data.temperature_range || null,
      first_frost: frost.first ? `${year}-${frost.first}` : null,
      last_frost:  frost.last  ? `${year + 1}-${frost.last}`  : null,
      microclimate_note: `USDA Zone ${data.zone}. ${
        zoneNum >= 10 ? "Frost-free or nearly so; year-round growing." :
        zoneNum <= 4  ? "Short season; protect tender plants." :
        "Distinct seasons; plant after last frost."
      }`,
      provenance: { source: "phzmapi.org", mode: "live", generated_at: new Date().toISOString() }
    };
  } catch (err) {
    console.warn(`[live:zone] fallback to mock — ${err.message}`);
    return null; // caller falls back to mock
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LIVE: Weather via Open-Meteo (NOAA GFS-backed, no API key)
// Docs: https://open-meteo.com/en/docs
// ─────────────────────────────────────────────────────────────────────────
export async function liveWeatherForecast(lat, lng) {
  if (!LIVE || lat == null || lng == null) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
      `&temperature_unit=fahrenheit&forecast_days=7&timezone=auto`;
    const data = await fetchJSON(url);
    if (!data?.daily?.time) return null;

    const d = data.daily;
    const forecast = d.time.map((date, i) => ({
      date,
      high_f: Math.round(d.temperature_2m_max[i]),
      low_f:  Math.round(d.temperature_2m_min[i]),
      precip_chance_pct: d.precipitation_probability_max[i] ?? 0,
      conditions: wmoToConditions(d.weather_code[i])
    }));

    const rainDays = forecast.filter(f => f.precip_chance_pct > 50).length;
    const minLow   = Math.min(...forecast.map(f => f.low_f));
    const watering = rainDays >= 3 ? "skip" : rainDays >= 1 ? "light" : "normal";

    return {
      tool: "get_weather_forecast",
      source: "Open-Meteo (NOAA GFS)",
      mode: "live",
      current: {
        temp_f: Math.round(data.current?.temperature_2m ?? forecast[0].high_f),
        humidity_pct: data.current?.relative_humidity_2m ?? null,
        conditions: wmoToConditions(data.current?.weather_code ?? 2)
      },
      forecast,
      frost_warning: minLow <= 36,
      watering_recommendation: watering,
      watering_explanation: rainDays >= 3
        ? "Multiple rain days ahead — skip irrigation this week."
        : rainDays >= 1
          ? "Some rain expected — reduce watering."
          : "Dry week — maintain normal watering.",
      provenance: { source: "open-meteo.com", mode: "live", generated_at: new Date().toISOString() }
    };
  } catch (err) {
    console.warn(`[live:weather] fallback to mock — ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LIVE: Soil via SoilGrids (ISRIC, no API key)
// Docs: https://rest.isric.org/soilgrids/v2.0/docs
// Returns clay/sand/silt %, pH, organic carbon by depth.
// ─────────────────────────────────────────────────────────────────────────
export async function liveSoilData(lat, lng) {
  if (!LIVE || lat == null || lng == null) return null;
  try {
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query` +
      `?lat=${lat}&lon=${lng}` +
      `&property=phh2o&property=clay&property=sand&property=silt&property=soc` +
      `&depth=0-5cm&value=mean`;
    const data = await fetchJSON(url);
    const layers = data?.properties?.layers;
    if (!layers) return null;

    const pick = (name) => {
      const layer = layers.find(l => l.name === name);
      const val = layer?.depths?.[0]?.values?.mean;
      return val != null ? val / (layer.unit_measure?.d_factor || 1) : null;
    };

    const ph    = pick("phh2o");       // pH * 10 → divide by d_factor
    const clay  = pick("clay");        // g/kg → %
    const sand  = pick("sand");
    const silt  = pick("silt");
    const soc   = pick("soc");         // organic carbon

    // Derive USDA texture class from clay/sand/silt
    let texture = "loam";
    if (clay != null && sand != null) {
      const c = clay / 10, s = sand / 10; // g/kg → %
      if (c >= 40) texture = "clay";
      else if (s >= 70) texture = "sandy loam";
      else if (c >= 27) texture = "clay loam";
      else if (s >= 52) texture = "loam";
      else texture = "silt loam";
    }

    return {
      tool: "get_soil_data",
      source: "SoilGrids (ISRIC)",
      mode: "live",
      texture,
      ph_range: ph != null ? { min: +(ph/10 - 0.3).toFixed(1), max: +(ph/10 + 0.3).toFixed(1) } : null,
      clay_pct: clay != null ? +(clay/10).toFixed(1) : null,
      sand_pct: sand != null ? +(sand/10).toFixed(1) : null,
      silt_pct: silt != null ? +(silt/10).toFixed(1) : null,
      organic_carbon: soc != null ? +(soc/10).toFixed(1) : null,
      amendment_suggestions: [
        ph != null && ph/10 < 6.0 ? "Soil is acidic — add lime to raise pH for most vegetables" :
        ph != null && ph/10 > 7.5 ? "Soil is alkaline — add elemental sulfur or peat for acid-loving plants" :
        "pH is in a good range for most plants",
        "Add 2–3 inches of compost annually to improve structure and fertility",
        texture === "clay" ? "Clay-heavy — add coarse organic matter to improve drainage" :
        texture.includes("sand") ? "Sandy — add compost to improve water retention" :
        "Mulch to retain moisture and suppress weeds"
      ],
      provenance: { source: "rest.isric.org/soilgrids", mode: "live", generated_at: new Date().toISOString() }
    };
  } catch (err) {
    console.warn(`[live:soil] fallback to mock — ${err.message}`);
    return null;
  }
}

export const LIVE_MODE = LIVE;

// ─────────────────────────────────────────────────────────────────────────
// LIVE: Geocode a US ZIP → lat/lng (Open-Meteo geocoding, no key)
// Lets soil + weather tools work when the user only gave a ZIP.
// ─────────────────────────────────────────────────────────────────────────
export async function liveGeocodeZip(zip) {
  if (!LIVE || !zip) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${zip}&count=1&country=US`;
    const data = await fetchJSON(url);
    const hit = data?.results?.[0];
    if (!hit) return null;
    return { latitude: hit.latitude, longitude: hit.longitude, place: hit.name };
  } catch (err) {
    console.warn(`[live:geocode] ${err.message}`);
    return null;
  }
}
