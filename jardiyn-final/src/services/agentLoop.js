import { executeTool } from './toolHandlers.js';

function wants(text, terms) {
  return terms.some(t => text.includes(t));
}

function routeTools(message = '', profile = {}) {
  const text = String(message).toLowerCase();
  const tools = [];

  if (wants(text, ['plan check', 'will fail', 'risky', 'realistic', 'check my plan', 'good idea'])) {
    tools.push('plan_check');
  }
  if (wants(text, ['garden plan', 'full plan', 'shopping list', 'weekend tasks', 'monthly report', 'report'])) {
    tools.push('generate_garden_plan');
  }
  if (wants(text, ['what should i plant', 'recommend', 'plant right now', 'native', 'pollinator', 'flowers', 'vegetables', 'herbs'])) {
    tools.push('lookup_plant_database');
  }
  if (wants(text, ['diagnose', 'yellow', 'spots', 'wilting', 'dying', 'pest', 'bug', 'disease', 'problem'])) {
    tools.push('diagnose_plant_issue');
  }
  if (wants(text, ['zone', 'zip', 'frost', 'hardiness']) || (!profile.hardiness_zone && profile.zip_code)) {
    tools.unshift('get_garden_zone');
  }
  if (wants(text, ['soil', 'clay', 'drainage', 'compost', 'amend'])) {
    tools.push('get_soil_profile');
  }
  if (wants(text, ['weather', 'watering', 'rain', 'heat', 'drought', 'freeze'])) {
    tools.push('get_weather_context');
  }
  if (wants(text, ['gis', 'parcel', 'satellite', 'drone', 'property passport'])) {
    tools.push('property_gis_preview');
  }

  if (!tools.length) tools.push('plan_check');
  return [...new Set(tools)].slice(0, 4);
}

function buildResponse({ message, profile, toolsUsed, results }) {
  const text = String(message || '').toLowerCase();
  const profileLine = [
    profile?.zip_code || profile?.zip ? `ZIP ${profile.zip_code || profile.zip}` : null,
    profile?.soil_type || profile?.soil ? `${profile.soil_type || profile.soil} soil` : null,
    profile?.sun_exposure || profile?.sun ? `${profile.sun_exposure || profile.sun} sun` : null,
    Array.isArray(profile?.goals) && profile.goals.length ? `goals: ${profile.goals.join(', ')}` : null
  ].filter(Boolean).join(' · ');

  if (toolsUsed.includes('generate_garden_plan')) {
    return `# Garden Plan\n\n## Site Summary\n${profileLine || 'Garden Passport context is limited. Start by confirming ZIP, sun, soil, and water access.'}\n\n## Main Goal\nBuild a realistic, low-risk garden plan that matches the actual site instead of copying inspiration that may not translate.\n\n## Recommended Plants\n- Black-eyed Susan or zinnia for reliable color\n- Herbs such as basil/chives for beginner wins\n- Native/pollinator plants if that is part of your goal\n- Start with 3–5 proven plants, not a full shopping cart\n\n## Avoid List\n- Plants that need opposite sun/drainage conditions\n- High-maintenance impulse buys\n- Large shrubs/trees before confirming mature size and site constraints\n\n## Soil Prep\nAdd compost on top, avoid working wet clay, and test drainage before planting.\n\n## Watering Guidance\nWater deeply for new plantings, then check soil moisture before repeating. Containers need more frequent checks.\n\n## Weekend Tasks\n1. Confirm sun hours.\n2. Check drainage.\n3. Buy a small starter group.\n4. Mulch after planting.\n\n## Shopping List\n- Compost\n- Mulch\n- 3–5 starter plants\n- Plant labels\n- Soaker hose or watering can\n\n## Safety Notes\nCall a professional for major grading, drainage against structures, retaining walls, large tree risk, or permit-related work.\n\n## Sources Used\nGarden Passport, JarDIYn plant intelligence, plan-check rubric.\n\n## Questions for a Local Nursery\nAsk: “Which of these are proven locally for my sun, soil, and maintenance level?”\n\n## When to Call a Professional\nIf water is moving toward the house, trees are unstable, or the project changes drainage/grade.`;
  }

  if (toolsUsed.includes('plan_check')) {
    return `# Plan Check\n\n## What looks good\n- You are asking before buying, which is the best way to avoid garden abandonment.\n- The plan can work if it is matched to sun, soil, water, and maintenance.\n\n## What may fail\n- The plant list may not match the actual site.\n- Clay/drainage or too much/too little sun can quietly kill a good idea.\n- A plan that is too big in year one is usually harder to maintain.\n\n## What needs more context\n${profileLine || '- ZIP/zone\n- Sun hours\n- Soil/drainage\n- Water access\n- Budget and maintenance tolerance'}\n\n## What I would change\n- Start smaller and build proof.\n- Choose plants for the actual conditions, not the inspiration image.\n- Buy in phases after checking drainage and sun.\n\n## Next 3 actions\n1. Confirm sun exposure at the planting area.\n2. Check soil moisture/drainage after rain.\n3. Pick 3–5 starter plants that match the site.`;
  }

  if (toolsUsed.includes('diagnose_plant_issue')) {
    return `# Plant Problem Triage\n\n## Most likely issue\nWater/root stress, drainage mismatch, or environmental stress are the first things to rule out before assuming disease.\n\n## What to check now\n- Soil moisture 2 inches down\n- Drainage around roots\n- Leaf undersides for pests\n- Recent heat, cold, or watering swings\n\n## What not to do yet\nDo not apply pesticide or fertilizer until the problem is better identified.\n\n## Next step\nTake one clear close-up photo of symptoms and one whole-plant photo, then compare with watering and sun history.`;
  }

  if (toolsUsed.includes('lookup_plant_database')) {
    return `# Plant Recommendations\n\n## Best-fit starting list\n- Black-eyed Susan\n- Purple coneflower\n- Bee balm\n- Zinnia\n- Basil or chives for edible beginner wins\n\n## Why these are safer\nThey are practical starter choices that can fit common home-garden goals when matched to sun, soil, and water.\n\n## Avoid\nAvoid buying high-maintenance plants or anything with unknown zone/sun/water fit.\n\n## Next action\nTake this list to a local nursery and ask which are locally proven for your exact conditions.`;
  }

  if (toolsUsed.includes('property_gis_preview')) {
    return `# Property Intelligence Preview\n\nProperty Passport, GIS import, satellite, and drone layers are future roadmap features. This MVP can discuss what those layers would add, but it should not imply parcel/GIS upload is live yet.\n\n## Future layers\n- Parcel boundary\n- Slope/drainage\n- Tree canopy\n- Flood/wetland constraints\n- Right-of-way/easement warnings\n\n## Guardrail\nThis would support planning, not replace a survey, permit review, engineer, arborist, or licensed professional.`;
  }

  return `# JarDIYn Recommendation\n\nUse the Garden Passport first: ZIP, sun, soil, drainage, water access, goals, budget, and maintenance tolerance.\n\n## Best next step\nAsk for either a Plan Check or a Garden Plan so JarDIYn can turn the site context into actions.\n\n## Why this matters\nMost garden failures are not character flaws. They are mismatches between inspiration and actual site conditions.`;
}

async function maybeRunClaude({ message, profile, history }) {
  const forceFallback = ['true', '1', 'yes'].includes(String(process.env.FORCE_FALLBACK_AGENT || '').toLowerCase());
  const key = process.env.ANTHROPIC_API_KEY;
  if (forceFallback || !key) return null;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 1200,
      system: 'You are JarDIYn, a grounded professional garden intelligence assistant. Be practical, concise, and site-specific. Do not overclaim. Include next actions and safety escalation where needed.',
      messages: [
        ...history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '') })),
        { role: 'user', content: `Garden profile: ${JSON.stringify(profile || {})}\n\nQuestion: ${message}` }
      ]
    });
    const response = msg.content?.map(c => c.text || '').join('\n').trim();
    if (!response) return null;
    return {
      response,
      answer: response,
      toolsUsed: ['claude_live_reasoning'],
      tools_used: ['claude_live_reasoning'],
      mode: 'live-llm',
      rounds: 1,
      sources: ['Garden Passport', 'Claude live reasoning'],
      trace: [{ step: 'llm_response', mode: 'live', model: msg.model, stop_reason: msg.stop_reason }]
    };
  } catch (err) {
    return null;
  }
}

export async function runGardenAgent({ message = '', profile = {}, gardenProfile = {}, history = [], sessionId = 'local-demo' } = {}) {
  const activeProfile = { ...(profile || {}), ...(gardenProfile || {}) };
  const live = await maybeRunClaude({ message, profile: activeProfile, history });
  if (live) return live;

  const toolsUsed = routeTools(message, activeProfile);
  const results = [];
  for (const tool of toolsUsed) {
    const input = {
      zip_code: activeProfile.zip_code || activeProfile.zip,
      user_soil: activeProfile.soil_type || activeProfile.soil,
      drainage: activeProfile.drainage,
      goals: activeProfile.goals || [],
      sun_exposure: activeProfile.sun_exposure || activeProfile.sun,
      plan_text: message,
      symptom_description: message,
      garden_profile: activeProfile,
      plan_goal: message,
      property_context: message
    };
    results.push(await executeTool(tool, input, activeProfile, sessionId));
  }

  const response = buildResponse({ message, profile: activeProfile, toolsUsed, results });
  const sources = [...new Set(['Garden Passport', ...results.map(r => r.source).filter(Boolean)])];

  return {
    response,
    answer: response,
    toolsUsed,
    tools_used: toolsUsed,
    mode: 'sandbox',
    rounds: 1,
    sources,
    trace: results.map((r, i) => ({
      step: 'tool_execution',
      order: i + 1,
      tool: r.tool,
      mode: r.mode,
      ok: r.ok,
      source: r.source,
      data: r.data
    }))
  };
}
