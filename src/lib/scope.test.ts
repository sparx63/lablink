import assert from "node:assert/strict";
import {
  canManageLab,
  canManageTimetable,
  filterByManagedLabs,
  isCampusWide,
  managedLabIds,
} from "./scope";
import type { User } from "./types";

function user(partial: Partial<User> & Pick<User, "id" | "role">): User {
  return {
    name: partial.name || partial.id,
    email: `${partial.id}@test.edu`,
    department: "Test",
    avatarColor: "#000",
    certifications: [],
    fineBalance: 0,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

function main() {
  const marcus = user({
    id: "u-faculty-elec",
    role: "FACULTY",
    managedLabIds: ["lab-elec", "lab-robot"],
  });
  const aisha = user({ id: "u-super", role: "SUPER_ADMIN" });
  const leah = user({ id: "u-timetable", role: "TIMETABLE_COORDINATOR" });
  const priya = user({ id: "u-student-1", role: "STUDENT" });

  assert.equal(isCampusWide(aisha), true);
  assert.equal(isCampusWide(marcus), false);
  assert.deepEqual(managedLabIds(marcus), ["lab-elec", "lab-robot"]);
  assert.equal(managedLabIds(aisha), null);
  assert.deepEqual(managedLabIds(leah), []);
  assert.equal(managedLabIds(priya), null);

  assert.equal(canManageLab(marcus, "lab-elec"), true);
  assert.equal(canManageLab(marcus, "lab-bio"), false);
  assert.equal(canManageLab(aisha, "lab-bio"), true);
  assert.equal(canManageLab(leah, "lab-elec"), false);
  assert.equal(canManageLab(priya, "lab-elec"), false);

  assert.equal(canManageTimetable(leah, "lab-elec"), true);
  assert.equal(canManageTimetable(marcus, "lab-elec"), true);
  assert.equal(canManageTimetable(marcus, "lab-bio"), false);

  const items = [{ labId: "lab-elec" }, { labId: "lab-bio" }, { labId: "lab-robot" }];
  assert.deepEqual(
    filterByManagedLabs(marcus, items).map((i) => i.labId),
    ["lab-elec", "lab-robot"]
  );
  assert.equal(filterByManagedLabs(aisha, items).length, 3);
  assert.equal(filterByManagedLabs(leah, items).length, 0);

  console.log("scope.test.ts passed");
}

main();
