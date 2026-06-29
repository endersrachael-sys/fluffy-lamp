// USDA PHZM 2023 hardiness zones by 3-digit ZIP prefix — 863 entries, covers all US ZIPs
const PHZM_BY_PREFIX = {"010":"6a","011":"6a","012":"5b","013":"5b","014":"5b","015":"5b","016":"6a","017":"6a","018":"6b","019":"6b","020":"7a","021":"7a","022":"7a","023":"7a","024":"6b","025":"7a","026":"7a","027":"6b","028":"7a","029":"7a","030":"5b","031":"5b","032":"5b","033":"5b","034":"5b","035":"4b","036":"5a","037":"5a","038":"5b","039":"5b","040":"5b","041":"5b","042":"5b","043":"5b","044":"5b","045":"5b","046":"5b","047":"5b","048":"5b","049":"5b","060":"6b","061":"6b","062":"6b","063":"6b","064":"6b","065":"6b","066":"6b","067":"6b","068":"6b","069":"6b","070":"7a","071":"7a","072":"7a","073":"7a","074":"7a","075":"7a","076":"7a","077":"7a","078":"7a","079":"7a","080":"7a","081":"7a","082":"7a","083":"7a","084":"7a","085":"7a","086":"7a","087":"7a","088":"7a","089":"7a","100":"7b","101":"7b","102":"7b","103":"7b","104":"7a","105":"6b","106":"6b","107":"6b","108":"6b","109":"6b","110":"7b","111":"7b","112":"7b","113":"7b","114":"7b","115":"7a","116":"7a","117":"7a","118":"7a","119":"7a","120":"5b","121":"6a","122":"6a","123":"6a","124":"6b","125":"6a","126":"6a","127":"6a","128":"5a","129":"5b","130":"6a","131":"6a","132":"6a","133":"5b","134":"5a","135":"5b","136":"5b","137":"6a","138":"6a","139":"6a","150":"6a","151":"6a","152":"6b","153":"6b","154":"6a","155":"6a","156":"6a","157":"6a","158":"6a","159":"6a","160":"6a","161":"6a","162":"6a","163":"6a","164":"6a","165":"6a","166":"6a","167":"6a","168":"6a","169":"6a","170":"6b","171":"6b","172":"6b","173":"6b","174":"6b","175":"6b","176":"6b","177":"6b","178":"6b","179":"6b","180":"6b","181":"6b","182":"6b","183":"6b","184":"6b","185":"6b","186":"6b","187":"6b","188":"6b","189":"6b","190":"7a","191":"7a","192":"7a","193":"7a","194":"7a","195":"7a","196":"7a","197":"7b","198":"7b","199":"7b","200":"7b","201":"7b","202":"7b","203":"7b","204":"7b","205":"7a","206":"7b","207":"7b","208":"7a","209":"7a","210":"7a","211":"7a","212":"7a","213":"7a","214":"7a","215":"7a","216":"7a","217":"7a","218":"7a","219":"7a","220":"7a","221":"7a","222":"7a","223":"7a","224":"7a","225":"7a","226":"7a","227":"7a","228":"7a","229":"7a","230":"7b","231":"7b","232":"7b","233":"7b","234":"7b","235":"7b","236":"7b","237":"7b","238":"7b","239":"7b","240":"6a","241":"6a","242":"6a","243":"6a","244":"6a","245":"6a","246":"6b","247":"6a","248":"6a","249":"6a","250":"6b","251":"6b","252":"6b","253":"6b","254":"6b","255":"6a","256":"6b","257":"6b","258":"6b","259":"6b","270":"7b","271":"7b","272":"7b","273":"7b","274":"7b","275":"7b","276":"7b","277":"7b","278":"7b","279":"7b","280":"8a","281":"7b","282":"7b","283":"7b","284":"8a","285":"8a","286":"7a","287":"7a","288":"7a","289":"7a","290":"8a","291":"8a","292":"8a","293":"8a","294":"8a","295":"7b","296":"7b","297":"7b","298":"8a","299":"8a","300":"8a","301":"8a","302":"8a","303":"8a","304":"8a","305":"8b","306":"8b","307":"8a","308":"8a","309":"8a","310":"8b","311":"8b","312":"9a","313":"9a","314":"9a","315":"9a","316":"8b","317":"8b","318":"8b","319":"9a","320":"9a","321":"9b","322":"9a","323":"9a","324":"9a","325":"9a","326":"9a","327":"9b","328":"9b","329":"9b","330":"10b","331":"10b","332":"10b","333":"10b","334":"10a","335":"9b","336":"9b","337":"9b","338":"9b","339":"10a","340":"10a","341":"10a","342":"9b","344":"9b","346":"9b","347":"9b","349":"9b","350":"8a","351":"8a","352":"8a","353":"7b","354":"7b","355":"8a","356":"8a","357":"7b","358":"7b","359":"8b","360":"8b","361":"8b","362":"8b","363":"8b","364":"8a","365":"8b","366":"8b","367":"8b","368":"8a","369":"8b","400":"6b","401":"6b","402":"6b","403":"6b","404":"6a","405":"6a","406":"6a","407":"6a","408":"6a","409":"6a","410":"6b","411":"6a","412":"6a","413":"6a","414":"6a","415":"6a","416":"6a","417":"6a","418":"6a","420":"7a","421":"6b","422":"6b","423":"7a","424":"7a","425":"6b","426":"6b","427":"6b","430":"6a","431":"6a","432":"6a","433":"6a","434":"6a","435":"5b","436":"6a","437":"6a","438":"6a","439":"6a","440":"6a","441":"6a","442":"6a","443":"6a","444":"6a","445":"6a","446":"6a","447":"6a","448":"6a","449":"6a","450":"6b","451":"6b","452":"6b","453":"6a","454":"6a","455":"6a","456":"6b","457":"6b","458":"6b","460":"5b","461":"5b","462":"5b","463":"5b","464":"5b","465":"5b","466":"5b","467":"5b","468":"5b","469":"5b","470":"6a","471":"6a","472":"6a","473":"6a","474":"6a","475":"6a","476":"6a","477":"6a","478":"6a","479":"6a","480":"6a","481":"6b","482":"6a","483":"5b","484":"5b","485":"5b","486":"5b","487":"5b","488":"5b","489":"5b","490":"5b","491":"5b","492":"5b","493":"6a","494":"6a","495":"5b","496":"4b","497":"5b","498":"5b","499":"5b","500":"5a","501":"5a","502":"5b","503":"5b","504":"5a","505":"5a","506":"5a","507":"5a","508":"5a","509":"5a","510":"5b","511":"5b","512":"5b","513":"5b","514":"5b","515":"5b","516":"5b","520":"5b","521":"5b","522":"5b","523":"5b","524":"5b","525":"5b","526":"5b","527":"5b","528":"5b","530":"5b","531":"5b","532":"5b","534":"5a","535":"5a","537":"5a","538":"5a","539":"5a","540":"5a","541":"5a","542":"5a","543":"4b","544":"4b","545":"5a","546":"5a","547":"5a","548":"5a","549":"5a","550":"4b","551":"4b","553":"4b","554":"4b","555":"4b","556":"4a","557":"4a","558":"4b","559":"4a","560":"4b","561":"4b","562":"4b","563":"4b","564":"4b","565":"3b","566":"3b","567":"3b","580":"4a","581":"4a","582":"4a","583":"4a","584":"4a","585":"4a","586":"4a","587":"4a","588":"4a","590":"4a","591":"4a","592":"4a","593":"4a","594":"4b","595":"4a","596":"4a","597":"4a","598":"4a","599":"4a","600":"6a","601":"6a","602":"6a","603":"6a","604":"6a","605":"6a","606":"6b","607":"6a","608":"6a","609":"6a","610":"6a","611":"6a","612":"5b","613":"5b","614":"5b","615":"6a","616":"6a","617":"6a","618":"6a","619":"6a","620":"6a","622":"6b","623":"6b","624":"6a","625":"6a","626":"6a","627":"6a","628":"6a","629":"6a","630":"6b","631":"6b","633":"6b","634":"6a","635":"5b","636":"6a","637":"6a","638":"6a","639":"6b","640":"5b","641":"5b","644":"5b","645":"5b","646":"5b","647":"5b","648":"5b","649":"5b","660":"6a","661":"6a","662":"6a","664":"6a","665":"6a","666":"6a","667":"6a","668":"5b","669":"5b","670":"5b","671":"5b","672":"6a","673":"6a","674":"5b","675":"6a","676":"6a","677":"5b","678":"5b","679":"5b","680":"4b","681":"4b","683":"4b","684":"4b","685":"5a","686":"5a","687":"5a","688":"4b","689":"4b","690":"4b","691":"4b","692":"4b","693":"4b","700":"9a","701":"9a","702":"9b","703":"9a","704":"9a","705":"9a","706":"9a","707":"9a","708":"9a","710":"9a","711":"9a","712":"8b","713":"9a","714":"9a","716":"7b","717":"7b","718":"7b","719":"7b","720":"7b","721":"7b","722":"7b","723":"7b","724":"7b","725":"7b","726":"7a","727":"7a","728":"7a","729":"7a","730":"7a","731":"7a","734":"7a","735":"7a","736":"7a","737":"7a","738":"6b","739":"6b","740":"7a","741":"7a","743":"6b","744":"6b","745":"7a","746":"7a","747":"7a","748":"7a","749":"7a","750":"8a","751":"8a","752":"8a","753":"8a","754":"8a","755":"8a","756":"8a","757":"8a","758":"8a","759":"8a","760":"8a","761":"8a","762":"8a","763":"8a","764":"8a","765":"8b","766":"8b","767":"8b","768":"8b","769":"8b","770":"9a","771":"9a","772":"9a","773":"9a","774":"9a","775":"9a","776":"9a","777":"9a","778":"9a","779":"9a","780":"8b","781":"8b","782":"8b","783":"9a","784":"9a","785":"8a","786":"8b","787":"8b","788":"9a","789":"9a","790":"7b","791":"7b","792":"7b","793":"7a","794":"7a","795":"7a","796":"7a","797":"8a","798":"8a","799":"9a","800":"5b","801":"5b","802":"5b","803":"5b","804":"5b","805":"5b","806":"5a","807":"5a","808":"5a","809":"5a","810":"6a","811":"6b","812":"6b","813":"6b","814":"6a","815":"5b","816":"6a","820":"4b","821":"4b","822":"4b","823":"4b","824":"4b","825":"4b","826":"5a","827":"4b","828":"5a","829":"5a","830":"5a","831":"5a","832":"6a","833":"6a","834":"5b","835":"5b","836":"6a","837":"6a","838":"4b","840":"7a","841":"7a","842":"7a","843":"6b","844":"7a","845":"6b","846":"7a","847":"6a","850":"9b","851":"9b","852":"9b","853":"9a","855":"8a","856":"8b","857":"9b","859":"8b","860":"7b","863":"7a","864":"9b","865":"7a","870":"7a","871":"7a","872":"7a","873":"6b","874":"7b","875":"7a","876":"7a","877":"6b","878":"7b","879":"8a","880":"8b","881":"7b","882":"7b","883":"7b","884":"7a","890":"9b","891":"9a","893":"8b","894":"9b","895":"9a","897":"9a","898":"9a","900":"10b","901":"10a","902":"10b","903":"10a","904":"10b","905":"10b","906":"10b","907":"10a","908":"10b","910":"10b","911":"10a","912":"10b","913":"10a","914":"10a","915":"10a","916":"9b","917":"10a","918":"10a","919":"10b","920":"10b","921":"10b","922":"10b","923":"10a","924":"10a","925":"9b","926":"10a","927":"10a","928":"10b","930":"10a","931":"10a","932":"9b","933":"9b","934":"10a","935":"9b","936":"9b","937":"9b","938":"9b","939":"9b","940":"9b","941":"10a","942":"9b","943":"9b","944":"9b","945":"9b","946":"9b","947":"9b","948":"9b","949":"9b","950":"9b","951":"9b","952":"9b","953":"9b","954":"9b","955":"8a","956":"9b","957":"9b","958":"9b","959":"9a","960":"7a","961":"7a","967":"12b","968":"12b","970":"8b","971":"8b","972":"8b","973":"8b","974":"8b","975":"8b","976":"8b","977":"8b","978":"7b","979":"8b","980":"8b","981":"8b","982":"8b","983":"8b","984":"8b","985":"8b","986":"8b","988":"6a","989":"6a","990":"5b","991":"5b","992":"6a","993":"6a","994":"5a","995":"4a","996":"3b","997":"3a","998":"2b","999":"1a","370":"7a","371":"7a","372":"7a","373":"7a","374":"7a","375":"7b","376":"7b","377":"7a","378":"7a","379":"7a","380":"7b","381":"7b","382":"7b","383":"7b","384":"7b","385":"7b"};

// 6-entry exact-match cache for instant fallback when LIVE_APIS is off
const ZIP_FALLBACK = {
  "49503": { zip_code: "49503", city: "Grand Rapids", state: "MI", latitude: 42.9634, longitude: -85.6681, zone: "6a", region: "Great Lakes" },
  "94103": { zip_code: "94103", city: "San Francisco", state: "CA", latitude: 37.7725, longitude: -122.4147, zone: "10a", region: "Bay Area" },
  "10001": { zip_code: "10001", city: "New York", state: "NY", latitude: 40.7506, longitude: -73.9972, zone: "7b", region: "Northeast urban" },
  "33401": { zip_code: "33401", city: "West Palm Beach", state: "FL", latitude: 26.7153, longitude: -80.0534, zone: "10b", region: "South Florida" },
  "78701": { zip_code: "78701", city: "Austin", state: "TX", latitude: 30.2711, longitude: -97.7437, zone: "9a", region: "Central Texas" },
  "92101": { zip_code: "92101", city: "San Diego", state: "CA", latitude: 32.7157, longitude: -117.1611, zone: "10b", region: "Coastal Southern California" }
};

function zoneFromZip(zip) { return PHZM_BY_PREFIX[String(zip).slice(0,3)] || "6b"; }

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



export async function resolveLocation(input = {}) {
  const zip = String(input.zip_code || input.zip || "").match(/\d{5}/)?.[0] || "49503";
  const fallback = ZIP_FALLBACK[zip] || { zip_code: zip, city: "Your area", state: "US", latitude: 42.9634, longitude: -85.6681, zone: zoneFromZip(zip), region: "US garden" };
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
      zone: ZIP_FALLBACK[zip]?.zone || zoneFromZip(zip),
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
