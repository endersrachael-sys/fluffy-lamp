import { addTask, addDiagnosis } from './store.js';

function normalizeZip(profile = {}, input = {}) {
  return input.zip_code || profile.zip_code || profile.zip || '49503';
}

export async function executeTool(name, input = {}, profile = {}, sessionId = 'local-demo') {
  switch (name) {
    case 'get_garden_zone': {
      const zip = normalizeZip(profile, input);
      const zone = zip.startsWith('49') ? '6a' : zip.startsWith('33') ? '10b' : zip.startsWith('94') ? '10a' : zip.startsWith('10') ? '7b' : '7a';
      return {
        tool: name,
        ok: true,
        mode: 'sandbox',
        source: 'JarDIYn zone cache',
        data: {
          zip_code: zip,
          hardiness_zone: zone,
          frost_note: zone.startsWith('6') ? 'Expect meaningful spring/fall frost timing risk.' : 'Frost risk depends on local microclimate.',
          confidence: 'medium'
        }
      };
    }
    case 'get_soil_profile': {
      const soil = input.user_soil || profile.soil_type || profile.soil || 'unknown';
      return {
        tool: name,
        ok: true,
        mode: 'sandbox',
        source: 'Garden Passport soil context',
        data: {
          soil_type: soil,
          drainage: input.drainage || profile.drainage || 'unknown',
          prep: soil.toLowerCase().includes('clay') ? 'Work with the clay: improve structure with compost, avoid over-tilling when wet, and plant clay-tolerant species.' : 'Confirm drainage before buying plants; soil drives the plan.',
          confidence: soil === 'unknown' ? 'low' : 'medium'
        }
      };
    }
    case 'get_weather_context': {
      return {
        tool: name,
        ok: true,
        mode: 'sandbox',
        source: 'Weather adapter placeholder',
        data: {
          watering_guidance: 'Check soil moisture 2 inches down before watering. Containers and new plantings dry first.',
          risk_flags: ['new planting stress', 'watering inconsistency'],
          confidence: 'medium'
        }
      };
    }
    case 'lookup_plant_database': {
      const goals = input.goals || profile.goals || [];
      const pollinator = goals.includes('pollinators') || goals.includes('natives') || String(input.search_query || '').includes('pollinator');
      return {
        tool: name,
        ok: true,
        mode: 'sandbox',
        source: 'JarDIYn plant intelligence cache',
        data: {
          recommendations: pollinator
            ? ['Black-eyed Susan', 'Purple coneflower', 'Bee balm', 'Aster', 'Little bluestem']
            : ['Basil', 'Cherry tomato', 'Zinnia', 'Marigold', 'Chives'],
          avoid: ['plants with unknown zone fit', 'high-water plants if drainage is poor', 'large impulse buys before soil is checked'],
          confidence: 'medium'
        }
      };
    }
    case 'diagnose_plant_issue': {
      addDiagnosis(sessionId, { suspected_issue: 'water / root stress', confidence: 'medium' });
      addTask(sessionId, { title: 'Check soil moisture at root depth', priority: 'high', reason: 'Diagnosis needs water/root context.' });
      return {
        tool: name,
        ok: true,
        mode: 'sandbox',
        source: 'JarDIYn diagnosis triage',
        data: {
          suspected_issue: 'water / root stress',
          confidence: 'medium',
          next_checks: ['Check drainage', 'Inspect leaf undersides', 'Confirm recent watering pattern', 'Look for root-bound containers'],
          safety: 'Do not apply pesticide until the pest/disease is identified.'
        }
      };
    }
    case 'plan_check': {
      addTask(sessionId, { title: 'Confirm sun and drainage before buying plants', priority: 'high', reason: 'Plan Check found missing site constraints.' });
      return {
        tool: name,
        ok: true,
        mode: 'sandbox',
        source: 'JarDIYn plan-check rubric',
        data: {
          good: ['You are thinking in goals, not just individual plants.'],
          risks: ['Soil, drainage, sun, and maintenance tolerance may not match the plant list.'],
          changes: ['Start smaller', 'Pick site-matched plants', 'Buy in phases'],
          next_actions: ['Confirm sun hours', 'Do a jar/soil drainage test', 'Buy a small starter group first']
        }
      };
    }
    case 'generate_garden_plan': {
      addTask(sessionId, { title: 'Create a small starter bed plan', priority: 'medium', reason: 'Garden Plan generated first implementation step.' });
      return {
        tool: name,
        ok: true,
        mode: 'sandbox',
        source: 'JarDIYn report builder',
        data: {
          sections: ['Site Summary', 'Main Goal', 'Recommended Plants', 'Avoid List', 'Soil Prep', 'Watering Guidance', 'Weekend Tasks', 'Shopping List', 'Safety Notes', 'Sources Used', 'Ask a Nursery', 'When to Call a Professional']
        }
      };
    }
    case 'property_gis_preview': {
      return {
        tool: name,
        ok: true,
        mode: 'roadmap',
        source: 'Roadmap only',
        data: { note: 'Property Passport / GIS import is future roadmap only, not live in this MVP.' }
      };
    }
    default:
      return { tool: name, ok: false, mode: 'error', source: 'unknown', data: { error: 'Unknown tool' } };
  }
}
