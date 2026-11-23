/**
 * Borrow flow — all three BorrowPurpose values via createBooking (API path parity).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lablink-borrow-"));
process.env.LABLINK_DATA_DIR = tmp;

async function main() {
  const store = await import("./store");
  await store.resetState();

  const priya = (await store.listUsers()).find((u) => u.id === "u-student-1")!;
  assert.ok(priya);

  const baseStart = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  baseStart.setUTCHours(9, 0, 0, 0);

  const purposes = [
    { borrowPurpose: "PERSONAL_PROJECT" as const, purpose: "Personal bench prototype", dayOffset: 0 },
    { borrowPurpose: "COLLEGE_PROJECT" as const, purpose: "College capstone PCB bring-up", dayOffset: 2 },
    {
      borrowPurpose: "COMPETITION" as const,
      purpose: "",
      dayOffset: 4,
      competition: {
        name: "Smart Systems Challenge",
        organiser: "IEEE Student Branch",
        date: "2026-12-15",
        website: "https://example.edu/ssc",
      },
    },
  ];

  for (const p of purposes) {
    const start = new Date(baseStart.getTime() + p.dayOffset * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
    const { booking } = await store.createBooking({
      equipmentId: "eq-fpga",
      studentId: priya.id,
      start: start.toISOString(),
      end: end.toISOString(),
      expectedReturnAt: end.toISOString(),
      purpose:
        p.purpose ||
        `Competition: ${p.competition!.name} (${p.competition!.organiser})`,
      usageType: "BORROW",
      borrowPurpose: p.borrowPurpose,
      competition: p.competition,
    });
    assert.equal(booking.usageType, "BORROW");
    assert.equal(booking.borrowPurpose, p.borrowPurpose);
    assert.ok(["PENDING", "NEEDS_INFO", "APPROVED"].includes(booking.status));
    if (p.borrowPurpose === "COMPETITION") {
      assert.ok(booking.competition?.name === "Smart Systems Challenge");
    }
  }

  console.log("store.borrow-purposes.test.ts passed", { purposes: purposes.length, tmp });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
