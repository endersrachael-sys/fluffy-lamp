const ZIP_FALLBACK = {
  "49503": { zip_code: "49503", city: "Grand Rapids", state: "MI", latitude: 42.9634, longitude: -85.6681, zone: "6a", region: "Great Lakes" },
  "94103": { zip_code: "94103", city: "San Francisco", state: "CA", latitude: 37.7725, longitude: -122.4147, zone: "10a", region: "Bay Area" },
  "10001": { zip_code: "10001", city: "New York", state: "NY", latitude: 40.7506, longitude: -73.9972, zone: "7b", region: "Northeast urban" },
  "33401": { zip_code: "33401", city: "West Palm Beach", state: "FL", latitude: 26.7153, longitude: -80.0534, zone: "10b", region: "South Florida" },
  "78701": { zip_code: "78701", city: "Austin", state: "TX", latitude: 30.2711, longitude: -97.7437, zone: "9a", region: "Central Texas" },
  "92101": { zip_code: "92101", city: "San Diego", state: "CA", latitude: 32.7157, longitude: -117.1611, zone: "10b", region: "Coastal Southern California" }
};

export function liveApisEnabled() {
  return process.env.LIVE_APIS === "true" || process.env.LIVE_APIS === "1";
}

export function isoNow() { return new Date().toISOString(); }

export function daysFromNow(days) {
  const date = new Date(Date.now() + days * 86400000);
  return date.toISOString().slice(0, 10);
}

function timeoutSignal(ms = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function fetchJson(url, options = {}, ms = 4500) {
  const { signal, done } = timeoutSignal(ms);
  try {
    const res = await fetch(url, { ...options, signal, headers: { "user-agent": "JarDIYn/5.2 garden intelligence", ...(options.headers || {}) } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally { done(); }
}

function stateZoneFallback(state) {
  const s = String(state || "").toUpperCase();
  if (["FL", "HI"].includes(s)) return "10a";
  if (["CA"].includes(s)) return "9b";
  if (["TX", "GA", "LA", "SC", "AL", "MS"].includes(s)) return "8b";
  if (["MI", "WI", "MN", "ND", "SD", "VT", "NH", "ME"].includes(s)) return "5b-6a";
  if (["NY", "PA", "OH", "IN", "IL", "NJ", "CT", "MA"].includes(s)) return "6b-7b";
  return "6b";
}

export async function resolveLocation(input = {}) {
  const zip = String(input.zip_code || input.zip || "").match(/\d{5}/)?.[0] || "49503";
  const fallback = ZIP_FALLBACK[zip] || { zip_code: zip, city: "Your area", state: "US", latitude: 42.9634, longitude: -85.6681, zone: "6a", region: "US garden" };
  if (!liveApisEnabled()) return { ...fallback, mode: "fallback", provider: "JarDIYn local ZIP profile" };
  try {
    const data = await fetchJson(`https://api.zippopotam.us/us/${zip}`, {}, 3500);
    const place = data.places?.[0];
    if (!place) throw new Error("ZIP not found");
    const state = place["state abbreviation"] || fallback.state;
    return {
      zip_code: zip,
      city: place["place name"] || fallback.city,
      state,
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
      zone: ZIP_FALLBACK[zip]?.zone || stateZoneFallback(state),
      region: ZIP_FALLBACK[zip]?.region || `${place["place name"] || "US"} region`,
      mode: "live",
      provider: "Zippopotam.us + JarDIYn PHZM cache"
    };
  } catch (error) {
    return { ...fallback, mode: "fallback", provider: "JarDIYn local ZIP profile", warning: error.message };
  }
}

function weatherCode(code) {
  const map = { 0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 95: "Thunderstorm" };
  return map[code] || "Variable";
}

export async function getWeather(input = {}) {
  const loc = await resolveLocation(input);
  if (!liveApisEnabled()) return fallbackWeather(loc);
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: loc.latitude,
      longitude: loc.longitude,
      current: "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,wind_speed_10m_max",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      precipitation_unit: "inch",
      timezone: "auto",
      forecast_days: String(Math.min(Number(input.days || 7), 10))
    }).toString();
    const data = await fetchJson(url.toString(), {}, 5000);
    const current = data.current || {};
    const daily = (data.daily?.time || []).map((date, idx) => ({
      date,
      high_f: data.daily.temperature_2m_max?.[idx],
      low_f: data.daily.temperature_2m_min?.[idx],
      precip_in: data.daily.precipitation_sum?.[idx],
      precip_probability: data.daily.precipitation_probability_max?.[idx],
      wind_mph: data.daily.wind_speed_10m_max?.[idx],
      condition: weatherCode(data.daily.weather_code?.[idx])
    }));
    return {
      mode: "live",
      provider: "Open-Meteo Forecast",
      location: loc,
      current: {
        temp_f: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        precip_in: current.precipitation,
        wind_mph: current.wind_speed_10m,
        condition: weatherCode(current.weather_code)
      },
      daily,
      summary: `${Math.round(current.temperature_2m ?? 0)}°F and ${weatherCode(current.weather_code).toLowerCase()} in ${loc.city}.`,
      checked_at: isoNow()
    };
  } catch (error) { return { ...fallbackWeather(loc), warning: error.message }; }
}

function fallbackWeather(loc) {
  const seasonal = new Date().getMonth();
  const temp = seasonal >= 5 && seasonal <= 8 ? 76 : seasonal <= 2 || seasonal === 11 ? 38 : 62;
  return {
    mode: "fallback",
    provider: "JarDIYn seasonal weather fallback",
    location: loc,
    current: { temp_f: temp, humidity: 58, precip_in: 0, wind_mph: 8, condition: "Seasonal estimate" },
    daily: Array.from({ length: 7 }, (_, i) => ({ date: daysFromNow(i), high_f: temp + 4, low_f: temp - 12, precip_in: i === 2 ? 0.25 : 0.03, precip_probability: i === 2 ? 55 : 18, wind_mph: 8 + i, condition: i === 2 ? "Rain chance" : "Workable" })),
    summary: `Seasonal estimate for ${loc.city}: workable conditions with monitor-worthy rain/frost windows.`,
    checked_at: isoNow()
  };
}

export async function getNoaaAlerts(input = {}) {
  const loc = await resolveLocation(input);
  if (!liveApisEnabled()) return fallbackNoaa(loc);
  try {
    const url = `https://api.weather.gov/alerts/active?point=${loc.latitude},${loc.longitude}`;
    const data = await fetchJson(url, { headers: { accept: "application/geo+json" } }, 5000);
    const alerts = (data.features || []).slice(0, 8).map((f) => ({
      event: f.properties?.event,
      severity: f.properties?.severity,
      urgency: f.properties?.urgency,
      headline: f.properties?.headline,
      instruction: f.properties?.instruction,
      expires: f.properties?.expires
    }));
    return { mode: "live", provider: "NOAA/National Weather Service", location: loc, alerts, count: alerts.length, summary: alerts.length ? `${alerts.length} active NOAA/NWS alert(s).` : "No active NOAA/NWS alerts for this location.", checked_at: isoNow() };
  } catch (error) { return { ...fallbackNoaa(loc), warning: error.message }; }
}

function fallbackNoaa(loc) {
  return { mode: "fallback", provider: "NOAA/NWS-ready fallback", location: loc, alerts: [], count: 0, summary: "No live NOAA alert retrieved; use local forecast if severe weather is possible.", checked_at: isoNow() };
}

export async function getPollen(input = {}) {
  const loc = await resolveLocation(input);
  if (!liveApisEnabled()) return fallbackPollen(loc);
  try {
    const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    url.search = new URLSearchParams({ latitude: loc.latitude, longitude: loc.longitude, hourly: "alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen", timezone: "auto", forecast_days: "3" }).toString();
    const data = await fetchJson(url.toString(), {}, 5000);
    const h = data.hourly || {};
    const latestIndex = Math.max(0, Math.min(6, (h.time || []).length - 1));
    const tree = Number(h.alder_pollen?.[latestIndex] || 0) + Number(h.birch_pollen?.[latestIndex] || 0);
    const grass = Number(h.grass_pollen?.[latestIndex] || 0);
    const weed = Number(h.mugwort_pollen?.[latestIndex] || 0) + Number(h.ragweed_pollen?.[latestIndex] || 0);
    const total = tree + grass + weed;
    const level = total > 150 ? "High" : total > 50 ? "Moderate" : "Low";
    return { mode: "live", provider: "Open-Meteo Air Quality", location: loc, level, index: Math.round(total), breakdown: { tree: Math.round(tree), grass: Math.round(grass), weed: Math.round(weed) }, summary: `${level} pollen signal: tree ${Math.round(tree)}, grass ${Math.round(grass)}, weed ${Math.round(weed)}.`, checked_at: isoNow() };
  } catch (error) { return { ...fallbackPollen(loc), warning: error.message }; }
}

function fallbackPollen(loc) {
  const month = new Date().getMonth();
  const level = month >= 3 && month <= 5 ? "Moderate" : month >= 7 && month <= 9 ? "Moderate" : "Low";
  return { mode: "fallback", provider: "JarDIYn seasonal pollen fallback", location: loc, level, index: level === "Moderate" ? 65 : 20, breakdown: { tree: month <= 5 ? 40 : 8, grass: month >= 4 && month <= 7 ? 22 : 7, weed: month >= 7 ? 35 : 5 }, summary: `${level} seasonal pollen estimate for ${loc.region}.`, checked_at: isoNow() };
}

export async function getRainfall(input = {}) {
  const loc = await resolveLocation(input);
  const days = Math.min(Number(input.days || 14), 30);
  if (!liveApisEnabled()) return fallbackRain(loc, days, input.soil);
  try {
    const end = daysFromNow(-1);
    const start = daysFromNow(-days);
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.search = new URLSearchParams({ latitude: loc.latitude, longitude: loc.longitude, start_date: start, end_date: end, daily: "precipitation_sum", precipitation_unit: "inch", timezone: "auto" }).toString();
    const data = await fetchJson(url.toString(), {}, 6000);
    const total = (data.daily?.precipitation_sum || []).reduce((sum, v) => sum + Number(v || 0), 0);
    return rainPayload("live", "Open-Meteo Archive", loc, days, total, input.soil);
  } catch (error) { return { ...fallbackRain(loc, days, input.soil), warning: error.message }; }
}

function fallbackRain(loc, days, soil) {
  const month = new Date().getMonth();
  const total = month >= 5 && month <= 8 ? 0.85 : 1.25;
  return rainPayload("fallback", "JarDIYn seasonal rainfall fallback", loc, days, total, soil);
}

function rainPayload(mode, provider, loc, days, total, soil = "") {
  const heavySoil = /clay|silt/i.test(soil || "");
  const guidance = total < 0.5 ? "Water established beds deeply once; check containers daily." : total < 1.2 ? "Usually enough for established beds; prioritize containers and new transplants." : heavySoil ? "Hold watering in clay-heavy areas; inspect drainage and avoid compaction." : "Rainfall is likely sufficient for most beds; spot-check containers.";
  return { mode, provider, location: loc, days, total_inches: Number(total.toFixed(2)), guidance, summary: `${Number(total.toFixed(2))} inches over ${days} days. ${guidance}`, checked_at: isoNow() };
}

export async function getSoil(input = {}) {
  const loc = await resolveLocation(input);
  const soil = String(input.soil || "").toLowerCase();
  let texture = soil || (loc.state === "MI" ? "sandy loam to clay loam" : loc.state === "TX" ? "clay loam" : loc.state === "FL" ? "sandy" : "loam");
  const drainage = input.drainage || (/clay/i.test(texture) ? "slow" : /sand/i.test(texture) ? "fast" : "moderate");
  const ph = loc.state === "FL" ? "often alkaline/sandy pockets" : loc.state === "MI" ? "slightly acidic to neutral" : "varies; test before correcting";
  return { mode: liveApisEnabled() ? "adapter-ready" : "fallback", provider: "SoilGrids/ISRIC-ready adapter + JarDIYn profile", location: loc, texture, drainage, ph_tendency: ph, amendments: /clay/i.test(texture) ? ["compost", "mulch", "avoid tilling wet soil"] : /sand/i.test(texture) ? ["compost", "organic mulch", "slow-release fertility"] : ["compost", "mulch", "soil test before major pH corrections"], summary: `${texture} with ${drainage} drainage tendency. Improve with compost and mulch before aggressive corrections.`, checked_at: isoNow() };
}

export async function getPlantSignals(input = {}) {
  const q = String(input.query || "plant").trim().toLowerCase();
  const known = {
    tomato: { name: "Tomato", botanical: "Solanum lycopersicum", sun: "full sun", water: "consistent", notes: "Avoid overhead watering; rotate yearly." },
    lavender: { name: "Lavender", botanical: "Lavandula spp.", sun: "full sun", water: "low once established", notes: "Needs sharp drainage; clay causes failure." },
    hydrangea: { name: "Hydrangea", botanical: "Hydrangea spp.", sun: "morning sun / afternoon shade", water: "moderate", notes: "Protect from hot afternoon sun and winter burn." },
    coneflower: { name: "Coneflower", botanical: "Echinacea spp.", sun: "full sun", water: "low to moderate", notes: "Pollinator-friendly; avoid rich wet soil." }
  };
  const key = Object.keys(known).find((k) => q.includes(k));
  const plant = known[key] || { name: input.query || "Recommended plant", botanical: "varies", sun: input.sun || "match to site", water: "establish first season", notes: "Confirm zone, sun, soil, and mature size before planting." };
  return { mode: liveApisEnabled() ? "adapter-ready" : "fallback", provider: "OpenFarm + iNaturalist-ready plant intelligence", plant, fit: { zone: input.zone || "check zone", sun: input.sun || plant.sun, soil: input.soil || "confirm drainage" }, summary: `${plant.name}: ${plant.notes}`, checked_at: isoNow() };
}
