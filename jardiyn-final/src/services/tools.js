export const toolRegistry = [
  {
    name: 'get_garden_zone',
    description: 'Looks up or estimates USDA hardiness zone, frost timing, and regional climate context from ZIP code.',
    live: true,
    source: 'JarDIYn zone cache / PHZM-ready adapter',
    input_schema: { type: 'object', properties: { zip_code: { type: 'string' } } }
  },
  {
    name: 'get_soil_profile',
    description: 'Returns soil texture, drainage, clay/sand/silt context, and soil-prep advice.',
    live: false,
    source: 'Garden Passport + soil adapter',
    input_schema: { type: 'object', properties: { zip_code: { type: 'string' }, user_soil: { type: 'string' }, drainage: { type: 'string' } } }
  },
  {
    name: 'get_weather_context',
    description: 'Returns current weather context, rain signal, heat/frost flags, and watering guidance.',
    live: false,
    source: 'Weather adapter',
    input_schema: { type: 'object', properties: { zip_code: { type: 'string' } } }
  },
  {
    name: 'lookup_plant_database',
    description: 'Matches plants to zone, soil, sun, water, maintenance tolerance, and goals.',
    live: true,
    source: 'Curated JarDIYn plant cache',
    input_schema: { type: 'object', properties: { goals: { type: 'array', items: { type: 'string' } }, sun_exposure: { type: 'string' }, soil_type: { type: 'string' } } }
  },
  {
    name: 'diagnose_plant_issue',
    description: 'Provides cautious plant problem triage from symptoms and Garden Passport context.',
    live: false,
    source: 'JarDIYn diagnosis rules',
    input_schema: { type: 'object', properties: { symptom_description: { type: 'string' }, plant_name: { type: 'string' } }, required: ['symptom_description'] }
  },
  {
    name: 'plan_check',
    description: 'Checks a garden idea for likely failure points, risks, missing context, and better next steps.',
    live: false,
    source: 'JarDIYn plan-check rubric',
    input_schema: { type: 'object', properties: { plan_text: { type: 'string' }, garden_profile: { type: 'object' } }, required: ['plan_text'] }
  },
  {
    name: 'generate_garden_plan',
    description: 'Generates a practical Garden Plan with site summary, plants, avoid list, soil prep, watering, tasks, shopping list, and escalation notes.',
    live: false,
    source: 'JarDIYn report builder',
    input_schema: { type: 'object', properties: { garden_profile: { type: 'object' }, plan_goal: { type: 'string' } }, required: ['garden_profile'] }
  },
  {
    name: 'property_gis_preview',
    description: 'Roadmap-only preview of future Property Passport / municipal GIS import. Does not imply GIS upload is live.',
    live: false,
    source: 'Roadmap only',
    input_schema: { type: 'object', properties: { property_context: { type: 'string' } } }
  }
];

export function publicTools() {
  return {
    total: toolRegistry.length,
    live_apis_enabled: process.env.LIVE_APIS !== 'false',
    tools: toolRegistry
  };
}
