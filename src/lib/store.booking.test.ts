/**
 * Booking + lab-scope + timetable visibility — runs against an isolated temp data dir.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lablink-test-"));
process.env.LABLINK_DATA_DIR = tmp;

async function main() {
  // Dynamic import AFTER env is set so store picks up the temp dir.
  const store = await import("./store");
  await store.resetState();

  const marcus = (await store.listUsers()).find((u) => u.id === "u-faculty-elec")!;
  const priya = (await store.listUsers()).find((u) => u.id === "u-student-1")!;
  const arjun = (await store.listUsers()).find((u) => u.id === "u-student-2")!;

  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const { booking } = await store.createBooking({
    equipmentId: "eq-fpga",
    studentId: priya.id,
    start: start.toISOString(),
    end: end.toISOString(),
    purpose: "Store test in-lab",
    usageType: "IN_LAB",
  });
  assert.equal(booking.status, "PENDING");
  assert.equal(booking.labId, "lab-elec");

  const pending = await store.listBookings({ status: "PENDING", usageType: "IN_LAB" }, marcus);
  assert.ok(pending.some((b) => b.id === booking.id), "Marcus must see pending for managed lab");
  assert.ok(
    pending.every((b) => ["lab-elec", "lab-robot"].includes(b.labId)),
    "Marcus must not see other labs"
  );

  const approved = await store.decideBooking(booking.id, "APPROVED", marcus.id, "OK");
  assert.equal(approved.status, "APPROVED");

  // Timetable publish visibility
  const leah = (await store.listUsers()).find((u) => u.id === "u-timetable")!;
  const event = await store.upsertTimetableEvent(
    {
      labId: "lab-elec",
      title: "Test Embedded Session",
      subject: "ECE301 — Embedded Systems",
      cohort: "ECE Sem 5 Sec A",
      dayOfWeek: 2,
      startHour: 14,
      endHour: 16,
      eventType: "CLASS",
      facultyId: marcus.id,
      published: true,
    },
    leah
  );
  assert.ok(event.id);

  const priyaTt = await store.getStudentLabTimetable(priya.id);
  const priyaTitles = (priyaTt.schedule || [])
    .map((r: { event?: { title?: string } | null }) => r.event?.title)
    .filter(Boolean);
  assert.ok(priyaTitles.includes("Test Embedded Session"), "enrolled student sees published class");

  const arjunTt = await store.getStudentLabTimetable(arjun.id);
  const arjunTitles = (arjunTt.schedule || [])
    .map((r: { event?: { title?: string } | null }) => r.event?.title)
    .filter(Boolean);
  assert.ok(!arjunTitles.includes("Test Embedded Session"), "non-enrolled student My TT excludes it");

  const bookingView = await store.listTimetable("lab-elec", null, {
    forBooking: true,
    publishedOnly: true,
  });
  assert.ok(
    bookingView.some((e) => e.id === event.id),
    "any student can see published lab TT while booking"
  );

  // Exam generate + start → student visibility
  const exams = await store.listPracticalExams("lab-elec", marcus);
  const exam = exams.find((e) => e.status === "SCHEDULED" || e.status === "DRAFT") || exams[0];
  assert.ok(exam, "seed exam required");
  const bank = await store.listExperimentBank("lab-elec", marcus);
  const gen = await store.generateExamAllocations(
    {
      examId: exam.id,
      experimentIds: bank.slice(0, 3).map((e) => e.id),
      mode: "INDIVIDUAL",
      save: true,
    },
    marcus
  );
  assert.equal(gen.saved, true);
  assert.ok(gen.allocations.some((a) => a.studentId === priya.id));

  // End first if already LIVE from seed pollution, or start a fresh one via create
  let liveExam = exam;
  if (exam.status === "LIVE") {
    // already live — student should see
  } else if (exam.status === "SCHEDULED" || exam.status === "DRAFT") {
    liveExam = await store.startPracticalExam(exam.id, marcus);
  }
  const studentExams = await store.getStudentExaminations(priya.id);
  if (liveExam.status === "LIVE") {
    assert.ok(
      studentExams.some((row) => row && row.exam.id === liveExam.id),
      "student sees LIVE exam assignment"
    );
  }

  console.log("store.booking.test.ts passed", { booking: booking.id, event: event.id, tmp });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
