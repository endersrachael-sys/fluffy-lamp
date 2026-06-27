import assert from "node:assert/strict";
import { runGardenAgent } from "../src/services/agentLoop.js";
import { publicToolRegistry } from "../src/services/tools.js";

process.env.FORCE_FALLBACK_AGENT = "true";

const profile = {
  site_name: "Evaluation Yard",
  zip_code: "49503",
  soil_type: "clay loam",
  sun_exposure: "partial_shade",
  goals: ["pollinators", "native plants", "low maintenance"],
  maintenance_tolerance: "low",
  drainage: "poor drainage",
  deer_pressure: "moderate",
  known_problems: ["heavy clay", "plants failed last year"]
};

const tests = [
  {
    name: "tool registry is available",
    run: async () => assert.equal(publicToolRegistry().length >= 7, true)
  },
  {
    name: "plan check returns plan_check tool",
    run: async () => {
      const r = await runGardenAgent("Plan Check: I want lavender, tomatoes, and hydrangeas in wet clay shade.", profile);
      assert.equal(r.toolsUsed.includes("plan_check"), true);
      assert.match(r.answer, /What may fail|What I would change|Next 3 actions/i);
    }
  },
  {
    name: "garden plan returns Garden Plan sections",
    run: async () => {
      const r = await runGardenAgent("Generate a complete Garden Plan.", profile);
      assert.equal(r.toolsUsed.includes("generate_garden_plan"), true);
      assert.match(r.answer, /Site Summary|Recommended Plants|Shopping List/i);
    }
  },
  {
    name: "plant recommendation calls plant database",
    run: async () => {
      const r = await runGardenAgent("Recommend native pollinator plants for this yard.", profile);
      assert.equal(r.toolsUsed.includes("lookup_plant_database"), true);
    }
  },
  {
    name: "diagnosis calls diagnosis tool",
    run: async () => {
      const r = await runGardenAgent("My tomato has yellow leaves and dark spots. What should I do?", profile);
      assert.equal(r.toolsUsed.includes("diagnose_plant_issue"), true);
      assert.match(r.answer, /triage|Safe next steps|diagnosis/i);
    }
  },
  {
    name: "future GIS is roadmap only",
    run: async () => {
      const r = await runGardenAgent("Can I upload municipal GIS and use satellite or drone flyovers?", profile);
      assert.equal(r.toolsUsed.includes("property_gis_preview"), true);
      assert.match(r.answer, /Roadmap|not live|Future/i);
    }
  },
  {
    name: "response contains trace and sources",
    run: async () => {
      const r = await runGardenAgent("Should I water this week?", profile);
      assert.equal(Array.isArray(r.sourcesUsed), true);
      assert.equal(Array.isArray(r.trace), true);
      assert.equal(Boolean(r.requestId), true);
    }
  }
];

let passed = 0;
for (const t of tests) {
  try {
    await t.run();
    console.log(`✓ ${t.name}`);
    passed += 1;
  } catch (err) {
    console.error(`✗ ${t.name}`);
    console.error(err);
    process.exitCode = 1;
  }
}
console.log(`\n${passed}/${tests.length} evaluation checks passed.`);
