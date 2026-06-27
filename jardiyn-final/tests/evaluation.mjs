import assert from 'node:assert/strict';
import { publicTools } from '../src/services/tools.js';
import { runGardenAgent } from '../src/services/agentLoop.js';

process.env.FORCE_FALLBACK_AGENT = process.env.FORCE_FALLBACK_AGENT || 'true';

const tests = [
  ['tool registry is available', async () => {
    const tools = publicTools();
    assert.equal(tools.total, 8);
    assert.ok(tools.tools.some(t => t.name === 'plan_check'));
  }],
  ['plan check returns plan_check tool', async () => {
    const res = await runGardenAgent({ message: 'Plan Check: will this clay soil pollinator garden fail?', profile: { zip_code: '49503', soil_type: 'clay', goals: ['pollinators'] } });
    assert.ok(res.toolsUsed.includes('plan_check'));
    assert.match(res.response, /What may fail|Plan Check/i);
  }],
  ['garden plan returns Garden Plan sections', async () => {
    const res = await runGardenAgent({ message: 'Generate a full Garden Plan with shopping list and weekend tasks.', profile: { zip_code: '49503' } });
    assert.ok(res.toolsUsed.includes('generate_garden_plan'));
    assert.match(res.response, /Shopping List/i);
    assert.match(res.response, /Weekend Tasks/i);
  }],
  ['plant recommendation calls plant database', async () => {
    const res = await runGardenAgent({ message: 'Recommend native pollinator plants.', profile: { goals: ['pollinators', 'natives'] } });
    assert.ok(res.toolsUsed.includes('lookup_plant_database'));
  }],
  ['diagnosis calls diagnosis tool', async () => {
    const res = await runGardenAgent({ message: 'Diagnose yellow wilting tomato leaves.', profile: {} });
    assert.ok(res.toolsUsed.includes('diagnose_plant_issue'));
  }],
  ['future GIS is roadmap only', async () => {
    const res = await runGardenAgent({ message: 'Can I upload parcel GIS and drone data?', profile: {} });
    assert.ok(res.toolsUsed.includes('property_gis_preview'));
    assert.match(res.response, /roadmap|future/i);
  }],
  ['response contains trace and sources', async () => {
    const res = await runGardenAgent({ message: 'What should I plant right now?', profile: { zip_code: '49503' } });
    assert.ok(Array.isArray(res.trace));
    assert.ok(Array.isArray(res.sources));
    assert.ok(res.trace.length > 0);
  }]
];

let passed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}
console.log(`\n${passed}/${tests.length} evaluation checks passed.`);
if (passed !== tests.length) process.exit(1);
