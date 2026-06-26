/**
 * JarDIYn — MCP Tool Definitions
 * ================================
 * Requirement 5: Each tool has a name, description, and input_schema.
 * These are passed in the `tools` array on every relevant Claude API call.
 *
 * The descriptions are written so that Claude can autonomously decide
 * WHICH tool to call (or whether to call any tool at all) based solely
 * on reading these definitions alongside the user's message.
 *
 * Requirement 7 (agentic behavior) depends entirely on these descriptions
 * being precise enough that the model's own judgment drives dispatch —
 * not a hard-coded if/switch in application code.
 */

export const JARDIYN_TOOLS = [

  // ─────────────────────────────────────────────────────────────────
  // TOOL 1 — identify_plant
  // Maps to: POST /api/identify  ·  PlantObservation entity
  // ─────────────────────────────────────────────────────────────────
  {
    name: "identify_plant",
    description: `Identifies a plant, pest, or disease from a user-uploaded photo.
Use this tool whenever the user shares an image or describes a visible symptom
they want diagnosed (yellowing leaves, spots, unknown species, bug damage, etc.).
Do NOT call this tool if no image or symptom description is present.

Returns: species candidates ranked by confidence, observable symptoms,
an organic remedy recommendation, and a confidence score (0–1).
Low-confidence results (< 0.6) are flagged for human review.`,
    input_schema: {
      type: "object",
      properties: {
        image_base64: {
          type: "string",
          description: "Base64-encoded image of the plant, pest, or symptom. EXIF must be stripped before passing."
        },
        symptom_description: {
          type: "string",
          description: "Optional free-text description of the visible symptom if no image is available or to supplement the image."
        },
        garden_zone: {
          type: "string",
          description: "USDA hardiness zone of the garden (e.g. '7b'). Used to filter zone-appropriate species candidates."
        },
        soil_type: {
          type: "string",
          description: "Soil type from the garden profile (e.g. 'clay loam'). Helps narrow pest and disease likelihood."
        }
      },
      required: ["symptom_description"]
    }
  },

  // ─────────────────────────────────────────────────────────────────
  // TOOL 2 — get_garden_zone
  // Maps to: POST /api/zone  ·  SiteProfile entity
  // ─────────────────────────────────────────────────────────────────
  {
    name: "get_garden_zone",
    description: `Looks up the USDA hardiness zone, last frost date, first frost date,
average annual rainfall, and regional microclimate note for a garden location.
Use this tool when the user asks about their zone, when setting up a new garden
profile, or when a recommendation requires knowing frost dates or climate context.
Do NOT call this if the zone is already present in the garden profile.

Returns: hardiness_zone (string), first_frost (ISO date), last_frost (ISO date),
avg_rainfall_inches (number), microclimate_note (string).`,
    input_schema: {
      type: "object",
      properties: {
        zip_code: {
          type: "string",
          description: "US ZIP code for the garden location."
        },
        latitude: {
          type: "number",
          description: "Latitude coordinate. Use instead of zip_code if more precise location is available."
        },
        longitude: {
          type: "number",
          description: "Longitude coordinate. Required if latitude is provided."
        }
      },
      required: []
    }
  },

  // ─────────────────────────────────────────────────────────────────
  // TOOL 3 — get_soil_data
  // Maps to: POST /api/zone (soil sub-call)  ·  SiteProfile entity
  // Source: USDA Web Soil Survey / SoilWeb API
  // ─────────────────────────────────────────────────────────────────
  {
    name: "get_soil_data",
    description: `Fetches soil type, texture, pH range, drainage class, and land capability
classification (LCC) for a garden location from the USDA Web Soil Survey.
Use this tool when the user asks about their soil, when generating a DIY report
that includes soil recommendations, or when the garden profile lacks soil data.
Do NOT call this if soil_type is already confirmed in the garden profile.

Returns: soil_series (string), texture (string), ph_range (object with min/max),
drainage_class (string), lcc (string), organic_matter_pct (number),
amendment_suggestions (array of strings).`,
    input_schema: {
      type: "object",
      properties: {
        latitude: {
          type: "number",
          description: "Latitude coordinate of the garden site."
        },
        longitude: {
          type: "number",
          description: "Longitude coordinate of the garden site."
        },
        zip_code: {
          type: "string",
          description: "ZIP code fallback if coordinates are not available."
        }
      },
      required: []
    }
  },

  // ─────────────────────────────────────────────────────────────────
  // TOOL 4 — get_weather_forecast
  // Maps to: POST /api/schedule  ·  Task entity
  // ─────────────────────────────────────────────────────────────────
  {
    name: "get_weather_forecast",
    description: `Returns current weather conditions and a 7-day forecast for a garden location.
Use this tool when generating a watering schedule, when the user asks if they
need to water today, when checking for frost risk, or when seasonal care timing
depends on current conditions. Do NOT call this for historical or annual climate
data — use get_garden_zone for that.

Returns: current (temp_f, humidity_pct, conditions), forecast (array of 7 days,
each with high_f, low_f, precip_chance_pct, conditions), frost_warning (boolean),
watering_recommendation (string: 'skip' | 'light' | 'normal' | 'deep').`,
    input_schema: {
      type: "object",
      properties: {
        latitude: {
          type: "number",
          description: "Latitude coordinate of the garden."
        },
        longitude: {
          type: "number",
          description: "Longitude coordinate of the garden."
        },
        zip_code: {
          type: "string",
          description: "ZIP code fallback if coordinates are not available."
        }
      },
      required: []
    }
  },

  // ─────────────────────────────────────────────────────────────────
  // TOOL 5 — generate_diy_report
  // Maps to: POST /api/report  ·  Report entity
  // ─────────────────────────────────────────────────────────────────
  {
    name: "generate_diy_report",
    description: `Generates a personalized monthly DIY garden report for a user's garden profile.
The report includes priority actions, soil amendment guidance, watering recommendations,
pest watch items, and seasonal tasks — all grounded in the garden's zone, soil, and goals.
Use this tool when the user asks for a report, monthly priorities, or a garden action plan.
Do NOT call this for a single quick question — use it only when a full report is appropriate.

Returns: report_markdown (string), summary (string), priority_actions (array),
soil_section (string), water_section (string), pest_watch (array),
seasonal_tasks (array), model_version (string), prompt_version (string),
confidence (number), citations (array of source strings).`,
    input_schema: {
      type: "object",
      properties: {
        garden_profile: {
          type: "object",
          description: "The full GardenProfile object including zone, soil_type, sun_exposure, goals, and plant inventory.",
          properties: {
            site_name:       { type: "string" },
            hardiness_zone:  { type: "string" },
            soil_type:       { type: "string" },
            sun_exposure:    { type: "string", enum: ["full_sun", "partial_shade", "full_shade"] },
            goals:           { type: "array", items: { type: "string" } },
            plant_inventory: { type: "array", items: { type: "object" } }
          },
          required: ["hardiness_zone"]
        },
        month: {
          type: "integer",
          description: "Month number (1–12) for the report. Defaults to current month if omitted.",
          minimum: 1,
          maximum: 12
        },
        include_weather: {
          type: "boolean",
          description: "If true, incorporate current weather forecast into watering section. Requires lat/lng."
        },
        latitude:  { type: "number" },
        longitude: { type: "number" }
      },
      required: ["garden_profile"]
    }
  },

  // ─────────────────────────────────────────────────────────────────
  // TOOL 6 — lookup_plant_database
  // Maps to: Trefle / USDA PLANTS  ·  RAG context for Recommendation entity
  // ─────────────────────────────────────────────────────────────────
  {
    name: "lookup_plant_database",
    description: `Searches the plant species database for zone-appropriate plants matching
specific criteria (sun needs, water needs, soil type, bloom season, plant type).
Use this tool when the user asks for plant recommendations, companion planting
suggestions, or wants to know what grows well in their zone and soil conditions.
Do NOT call this for pest or disease identification — use identify_plant for that.

Returns: matching_plants (array of up to 10 plants, each with common_name,
latin_name, zone_range, water_needs, sun_needs, bloom_season, mature_height_ft,
companion_plants, avoid_near).`,
    input_schema: {
      type: "object",
      properties: {
        hardiness_zone: {
          type: "string",
          description: "USDA hardiness zone to filter compatible plants (e.g. '6a', '9b')."
        },
        plant_type: {
          type: "string",
          enum: ["annual", "perennial", "shrub", "tree", "vegetable", "herb", "groundcover", "vine"],
          description: "Category of plant to search."
        },
        sun_exposure: {
          type: "string",
          enum: ["full_sun", "partial_shade", "full_shade"],
          description: "Sun requirement filter."
        },
        water_needs: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Water requirement filter."
        },
        soil_type: {
          type: "string",
          description: "Soil type filter (e.g. 'clay', 'sandy loam', 'loam')."
        },
        bloom_season: {
          type: "string",
          enum: ["spring", "summer", "fall", "winter", "year_round"],
          description: "Optional bloom season filter."
        },
        search_query: {
          type: "string",
          description: "Free-text search (e.g. 'drought-tolerant native pollinator plants')."
        }
      },
      required: ["hardiness_zone"]
    }
  },

  // ─────────────────────────────────────────────────────────────────
  // TOOL 7 — get_frost_alerts
  // Maps to: NOAA / National Weather Service active alerts
  // Source: api.weather.gov (no key, US government)
  // ─────────────────────────────────────────────────────────────────
  {
    name: "get_frost_alerts",
    description: `Checks the NOAA National Weather Service for active frost, freeze, or
hard-freeze warnings and advisories at a garden location. Use this tool when the user
asks whether they need to protect plants tonight, when frost is a concern, or when
generating cold-sensitive planting or harvest timing advice. This returns OFFICIAL
government weather alerts — more authoritative for protection decisions than a raw
temperature forecast. Do NOT call this for general weather (use get_weather_forecast).

Returns: active_alerts (array of NWS alerts with event, severity, headline, expires),
frost_risk (boolean), protection_advice (string), and a no-alerts confirmation when clear.`,
    input_schema: {
      type: "object",
      properties: {
        latitude:  { type: "number", description: "Latitude of the garden." },
        longitude: { type: "number", description: "Longitude of the garden." },
        zip_code:  { type: "string", description: "ZIP code fallback if coordinates are not available." }
      },
      required: []
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // TOOL 8 — get_pollen_forecast
  // Maps to: Open-Meteo Air Quality API (no key)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "get_pollen_forecast",
    description: `Returns today's pollen forecast for a garden location using the Open-Meteo
Air Quality API. Use this tool when a user mentions allergies, asks about pollen,
or asks whether it is a good day to work in the garden from an allergy perspective.
Also useful when generating seasonal care advice in spring (high pollen season).
Do NOT call this for general weather — use get_weather_forecast for that.

Returns: grass_pollen, birch_pollen, mugwort_pollen levels (none/low/moderate/high/very high),
dominant allergen today, and specific gardening advice for allergy sufferers.`,
    input_schema: {
      type: "object",
      properties: {
        latitude:  { type: "number", description: "Garden latitude." },
        longitude: { type: "number", description: "Garden longitude." },
        zip_code:  { type: "string", description: "ZIP code if coordinates unavailable." }
      },
      required: []
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TOOL 9 — get_historical_weather
  // Maps to: Open-Meteo Historical Archive (no key)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "get_historical_weather",
    description: `Returns recent historical weather data (last 14 days by default) for a garden
location from the Open-Meteo archive. Use this tool when the user asks questions that
depend on recent weather context — "has it been dry lately?", "should I water given
recent rain?", "did we get enough rainfall this month?", or when generating watering
schedules that need to account for recent precipitation.
Do NOT call this for future weather — use get_weather_forecast for that.

Returns: total rainfall mm, average high temperature, number of rainy days,
and a soil moisture context summary for the period.`,
    input_schema: {
      type: "object",
      properties: {
        latitude:  { type: "number", description: "Garden latitude." },
        longitude: { type: "number", description: "Garden longitude." },
        zip_code:  { type: "string", description: "ZIP code if coordinates unavailable." },
        days:      { type: "number", description: "Number of days to look back (default 14, max 30)." }
      },
      required: []
    }
  }


];

/**
 * Tool name → human-readable label (for logs and UI)
 */
export const TOOL_LABELS = {
  identify_plant:       "Plant / Pest Identification",
  get_garden_zone:      "Zone & Frost Date Lookup",
  get_soil_data:        "Soil Data (USDA SoilWeb)",
  get_weather_forecast: "Weather Forecast",
  generate_diy_report:  "DIY Garden Report Generator",
  lookup_plant_database:"Plant Species Database",
  get_frost_alerts:       "NOAA Frost & Freeze Alerts",
  get_pollen_forecast:    "Pollen Forecast (Open-Meteo)",
  get_historical_weather: "Recent Weather History"
};
