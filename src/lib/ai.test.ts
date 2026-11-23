import assert from "node:assert/strict";
import { recommendAllocations } from "./ai";
import { createSeedState } from "./seed";

async function main() {
  const state = createSeedState();
  const suggestions = await recommendAllocations(state, {
    studentId: "u-student-1",
    projectId: "proj-1",
    labId: "lab-elec",
    equipmentId: "eq-scope",
    durationHours: 2,
  });

  assert.ok(suggestions.length > 0, "expected suggestions");
  assert.ok(suggestions.every((s) => s.labId === "lab-elec"), "must stay in selected lab");
  assert.equal(suggestions[0].equipmentId, "eq-scope", "selected component should rank first");
  assert.ok(suggestions[0].score >= suggestions[suggestions.length - 1].score, "scores should be sorted desc");
  assert.ok(suggestions.every((s) => s.suggestedStart && s.suggestedEnd), "slots required");

  const blocked = await recommendAllocations(state, {
    studentId: "u-student-2",
    labId: "lab-bio",
    equipmentId: "eq-pcr",
    durationHours: 2,
  });
  assert.ok(
    blocked.some((s) => s.conflicts.some((c) => c.toLowerCase().includes("fine"))),
    "student with fines should surface fine conflicts"
  );

  let threw = false;
  try {
    await recommendAllocations(state, {
      labId: "lab-elec",
      equipmentId: "eq-pcr",
    } as any);
  } catch {
    threw = true;
  }
  assert.ok(threw, "equipment outside selected lab must be rejected");

  console.log("ai.test.ts passed", { top: suggestions[0].equipmentId, count: suggestions.length });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
