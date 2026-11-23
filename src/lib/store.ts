import { promises as fs } from "fs";
import path from "path";
import { createSeedState, defaultPolicies, SAMPLE_CSV } from "./seed";
import {
  assertCanManageLab,
  assertCanManageTimetable,
  canManageLab,
  filterByManagedLabs,
  isCampusWide,
  managedLabIds,
} from "./scope";
import type {
  AiAllocationRequest,
  AiAllocationSuggestion,
  AppNotification,
  AppState,
  AuditEvent,
  AuditEventType,
  Booking,
  BorrowPurpose,
  ChecklistLine,
  CompetitionDetails,
  ExperimentBankItem,
  Fine,
  Incident,
  MarkRecord,
  PolicyConfig,
  PracticalExam,
  ExamAllocation,
  ExamAllocationGroup,
  ExamGenerateMode,
  ExamGenerateRequest,
  SavedResource,
  TimetableEvent,
  UsageType,
  User,
  WaitlistEntry,
} from "./types";
import { recommendAllocations } from "./ai";
import { formatHourRange, isGeneralTimetableCohort, makeClassKey } from "./format";
import { verifyCompetition } from "./verifyCompetition";

const DATA_DIR = process.env.LABLINK_DATA_DIR || path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "lablink.json");

let memory: AppState | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureLoaded(): Promise<AppState> {
  if (memory) return memory;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(DATA_FILE, "utf8");
    memory = migrateState(JSON.parse(raw) as AppState);
  } catch {
    memory = createSeedState();
    await persist();
  }
  return memory!;
}

/** Soft-migrate older JSON seeds so new fields don't crash the app. */
function migrateState(state: AppState): AppState {
  const seed = createSeedState();
  if (!state.timetable) state.timetable = seed.timetable;
  if (!state.enrollments) state.enrollments = seed.enrollments;
  if (!state.notifications) state.notifications = seed.notifications;
  if (!state.programmes) state.programmes = seed.programmes;
  if (!state.policies) state.policies = seed.policies || structuredClone(defaultPolicies);
  // Student Explore no longer offers project linking — do not hard-require projectId.
  if (state.policies?.evidenceRequirements) {
    state.policies.evidenceRequirements.projectLinkRequiredForCollege = false;
  }
  // Repair broken exam rows (missing reservation fields crashed every booking on .includes).
  if (Array.isArray(state.practicalExams)) {
    state.practicalExams = state.practicalExams
      .filter((ex) => ex && typeof ex.id === "string")
      .map((ex) => {
        const hasDate = typeof ex.examDate === "string" && ex.examDate.length >= 8;
        let status = ex.status || "DRAFT";
        // Incomplete LIVE/SCHEDULED rows must not participate in reservation math.
        if (!hasDate && (status === "LIVE" || status === "SCHEDULED")) status = "DRAFT";
        const rawCount =
          typeof ex.reservedUnitCount === "number" && ex.reservedUnitCount > 0 ? ex.reservedUnitCount : 1;
        return {
          ...ex,
          examDate: hasDate ? ex.examDate : "1970-01-01",
          status,
          reservedEquipmentIds: Array.isArray(ex.reservedEquipmentIds) ? ex.reservedEquipmentIds : [],
          // Leave spare units so Explore borrow demos are not fully locked out.
          reservedUnitCount: Math.min(rawCount, 2),
        };
      });
  }
  // Repair bookings missing window dates so conflict checks stay safe.
  if (Array.isArray(state.bookings)) {
    for (const b of state.bookings) {
      if (!b.start || !b.end) {
        b.status = b.status === "APPROVED" || b.status === "PENDING" ? "CANCELLED" : b.status;
      }
    }
  }
  if (!state.auditLog) state.auditLog = seed.auditLog || [];
  if (!state.experimentBank) state.experimentBank = seed.experimentBank;
  if (!state.practicalExams) state.practicalExams = seed.practicalExams;
  if (!state.examAllocations) state.examAllocations = seed.examAllocations;
  if (!state.markRecords) state.markRecords = seed.markRecords;
  if (!state.savedResources) state.savedResources = seed.savedResources || [];
  if (!state.sampleCsv) state.sampleCsv = seed.sampleCsv || SAMPLE_CSV;

  const hasCoordinator = state.users.some((u) => u.role === "TIMETABLE_COORDINATOR");
  if (!hasCoordinator) {
    const fromSeed = seed.users.find((u) => u.role === "TIMETABLE_COORDINATOR");
    if (fromSeed) state.users.push(structuredClone(fromSeed));
  }

  // Soft-merge demo roster / experiment bank so Generate List demos work on old .data files.
  for (const u of seed.users) {
    if (!state.users.some((x) => x.id === u.id)) state.users.push(structuredClone(u));
  }
  for (const exp of seed.experimentBank) {
    if (!state.experimentBank.some((x) => x.id === exp.id)) {
      state.experimentBank.push(structuredClone(exp));
    }
  }
  for (const en of seed.enrollments) {
    if (!state.enrollments.some((x) => x.id === en.id)) {
      state.enrollments.push(structuredClone(en));
    }
  }
  for (const tt of seed.timetable) {
    if (!state.timetable.some((x) => x.id === tt.id)) {
      state.timetable.push(structuredClone(tt));
    }
  }

  for (const u of state.users) {
    if (u.role === ("ADMIN" as User["role"]) && u.id === "u-admin") {
      u.role = "SUPER_ADMIN";
      u.id = "u-super";
    }
    if ((u.role === "FACULTY" || u.role === "ADMIN") && !u.managedLabIds) {
      u.managedLabIds = seed.users.find((s) => s.email === u.email)?.managedLabIds || [];
    }
  }
  for (const e of state.equipment) {
    if (!Array.isArray(e.tags)) e.tags = [];
    if (typeof e.quantity !== "number") e.quantity = 1;
    if (typeof e.borrowable !== "boolean") e.borrowable = e.tags.includes("borrowable") || false;
    if (!e.status) e.status = "AVAILABLE";
    if (!e.units && e.quantity > 1) {
      const seedEq = seed.equipment.find((s) => s.id === e.id);
      e.units = seedEq?.units ? structuredClone(seedEq.units) : undefined;
    }
    if (!e.accessoryChecklist) {
      const seedEq = seed.equipment.find((s) => s.id === e.id);
      if (seedEq?.accessoryChecklist) e.accessoryChecklist = structuredClone(seedEq.accessoryChecklist);
    }
  }
  for (const b of state.bookings) {
    if (!b.usageType) b.usageType = "IN_LAB";
    if (!b.status) b.status = "PENDING";
  }
  for (const t of state.timetable) {
    if (typeof t.published !== "boolean") t.published = true;
    if (!t.classKey && t.labId && t.subject && t.cohort) {
      t.classKey = makeClassKey(t.labId, t.subject, t.cohort);
    }
    if (typeof t.startHour !== "number") t.startHour = 9;
    if (typeof t.endHour !== "number") t.endHour = 11;
    if (typeof t.dayOfWeek !== "number") {
      if (t.eventDate) {
        const [y, m, d] = String(t.eventDate).split("-").map(Number);
        t.dayOfWeek = Number.isFinite(y) ? new Date(y, m - 1, d).getDay() : 1;
      } else {
        t.dayOfWeek = 1;
      }
    }
  }
  for (const en of state.enrollments) {
    if (!en.subject) en.subject = "Lab class";
    if (!en.cohort) en.cohort = "All";
  }
  // Drop a dangling session pointing at a removed user (avoids half-loaded shells).
  if (state.sessionUserId && !state.users.some((u) => u.id === state.sessionUserId)) {
    state.sessionUserId = null;
  }
  return state;
}

function appendAudit(
  state: AppState,
  type: AuditEventType,
  actor: User | null | undefined,
  summary: string,
  meta?: Record<string, unknown>
) {
  const event: AuditEvent = {
    id: uid("aud"),
    type,
    actorId: actor?.id || "system",
    actorName: actor?.name || "System",
    summary,
    meta,
    createdAt: new Date().toISOString(),
  };
  state.auditLog.unshift(event);
  if (state.auditLog.length > 500) state.auditLog.length = 500;
  return event;
}

function persist() {
  writeQueue = writeQueue.then(async () => {
    if (!memory) return;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(memory, null, 2), "utf8");
  });
  return writeQueue;
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function pushNotification(
  state: AppState,
  input: Omit<AppNotification, "id" | "createdAt" | "read"> & { read?: boolean }
) {
  state.notifications.unshift({
    ...input,
    id: uid("n"),
    createdAt: new Date().toISOString(),
    read: input.read ?? false,
  });
}

export async function getState() {
  return ensureLoaded();
}

export async function resetState() {
  memory = createSeedState();
  await persist();
  return memory;
}

export async function setSession(userId: string | null) {
  const state = await ensureLoaded();
  state.sessionUserId = userId;
  await persist();
  return state.users.find((u) => u.id === userId) || null;
}

export async function getSessionUser() {
  const state = await ensureLoaded();
  if (!state.sessionUserId) return null;
  return state.users.find((u) => u.id === state.sessionUserId) || null;
}

export async function listLabs(actor?: User | null) {
  const state = await ensureLoaded();
  const labs = state.labs;
  if (!actor || actor.role === "STUDENT" || isCampusWide(actor)) return labs;
  // Timetable coordinators need campus lab list for schedule management (not custody).
  if (actor.role === "TIMETABLE_COORDINATOR") return labs;
  const scope = managedLabIds(actor) || [];
  return labs.filter((l) => scope.includes(l.id));
}

export async function listEquipment(
  filters?: {
    q?: string;
    labId?: string;
    category?: string;
    availableOnly?: boolean;
    borrowableOnly?: boolean;
  },
  actor?: User | null
) {
  const state = await ensureLoaded();
  let items = state.equipment;

  // Staff (non-super) only see equipment in assigned labs. Students see campus-wide.
  if (actor && actor.role !== "STUDENT" && !isCampusWide(actor)) {
    items = filterByManagedLabs(actor, items);
  }

  if (filters?.labId) items = items.filter((e) => e.labId === filters.labId);
  if (filters?.category) {
    items = items.filter((e) => {
      const lab = state.labs.find((l) => l.id === e.labId);
      return lab?.category === filters.category;
    });
  }
  if (filters?.availableOnly) items = items.filter((e) => e.status === "AVAILABLE");
  if (filters?.borrowableOnly) items = items.filter((e) => e.borrowable);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    items = items.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.tag.toLowerCase().includes(q) ||
        e.tags.some((t) => t.includes(q)) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }
  return items.map((e) => ({
    ...e,
    lab: state.labs.find((l) => l.id === e.labId)!,
  }));
}

export async function listBookings(
  filters?: { studentId?: string; status?: string; usageType?: UsageType },
  actor?: User | null
) {
  const state = await ensureLoaded();
  let items = state.bookings;
  if (filters?.studentId) items = items.filter((b) => b.studentId === filters.studentId);
  if (filters?.status) items = items.filter((b) => b.status === filters.status);
  if (filters?.usageType) items = items.filter((b) => b.usageType === filters.usageType);

  if (actor && actor.role !== "STUDENT" && !isCampusWide(actor)) {
    items = filterByManagedLabs(actor, items);
  }

  return items
    .map((b) => ({
      ...b,
      equipment: state.equipment.find((e) => e.id === b.equipmentId)!,
      lab: state.labs.find((l) => l.id === b.labId)!,
      student: state.users.find((u) => u.id === b.studentId)!,
      project: state.projects.find((p) => p.id === b.projectId),
    }))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export async function findConflicts(equipmentId: string, start: string, end: string, excludeId?: string) {
  const state = await ensureLoaded();
  return state.bookings.filter(
    (b) =>
      b.equipmentId === equipmentId &&
      b.id !== excludeId &&
      !!b.start &&
      !!b.end &&
      !["REJECTED", "CANCELLED", "NO_SHOW", "CLOSED", "COMPLETED"].includes(b.status) &&
      overlaps(b.start, b.end, start, end)
  );
}

function availableUnits(state: AppState, equipmentId: string, start: string, end: string, excludeBookingId?: string) {
  const equipment = state.equipment.find((e) => e.id === equipmentId);
  if (!equipment?.units?.length) return [];
  const busy = new Set(
    state.bookings
      .filter(
        (b) =>
          b.equipmentId === equipmentId &&
          b.id !== excludeBookingId &&
          b.assignedUnitId &&
          !["REJECTED", "CANCELLED", "NO_SHOW", "CLOSED", "COMPLETED"].includes(b.status) &&
          overlaps(b.start, b.end, start, end)
      )
      .map((b) => b.assignedUnitId!)
  );
  // Exam reservations may reserve N units without a booking row.
  const examReserved = examUnitReservations(state, equipmentId, start, end);
  return equipment.units.filter(
    (u) =>
      !busy.has(u.id) &&
      !["RETIRED", "QUARANTINED", "MAINTENANCE"].includes(u.status) &&
      (u.status === "AVAILABLE" || busy.size + examReserved < equipment.units!.length)
  );
}

function examUnitReservations(state: AppState, equipmentId: string, start: string, end: string) {
  const startD = new Date(start);
  const endD = new Date(end);
  if (Number.isNaN(+startD) || Number.isNaN(+endD)) return 0;
  return (state.practicalExams || [])
    .filter((ex) => {
      if (!ex || !["SCHEDULED", "LIVE"].includes(ex.status)) return false;
      const reserved = ex.reservedEquipmentIds;
      if (!Array.isArray(reserved) || !reserved.includes(equipmentId)) return false;
      // Skip placeholder / incomplete dates from migrateState repairs.
      if (!ex.examDate || ex.examDate === "1970-01-01" || typeof ex.startHour !== "number" || typeof ex.endHour !== "number")
        return false;
      const exStart = new Date(`${ex.examDate}T${String(ex.startHour).padStart(2, "0")}:00:00`);
      const exEnd = new Date(`${ex.examDate}T${String(ex.endHour).padStart(2, "0")}:00:00`);
      if (Number.isNaN(+exStart) || Number.isNaN(+exEnd)) return false;
      return startD < exEnd && exStart < endD;
    })
    .reduce((n, ex) => n + (ex.reservedUnitCount || 1), 0);
}

function pickUnit(state: AppState, equipmentId: string, start: string, end: string) {
  const free = availableUnits(state, equipmentId, start, end).filter((u) => u.status === "AVAILABLE");
  return free[0] || availableUnits(state, equipmentId, start, end)[0] || null;
}

function localDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timetableConflictsForLab(
  state: AppState,
  labId: string,
  start: string,
  end: string
): string[] {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const day = startDate.getDay();
  const dateStr = localDateString(startDate);
  const startH = startDate.getHours() + startDate.getMinutes() / 60;
  const endH = endDate.getHours() + endDate.getMinutes() / 60;
  const hits = state.timetable.filter((ev) => {
    if (ev.labId !== labId) return false;
    if (ev.eventDate) {
      if (ev.eventDate !== dateStr) return false;
    } else if (ev.dayOfWeek !== day) {
      return false;
    }
    return startH < ev.endHour && ev.startHour < endH;
  });
  return hits.map(
    (ev) =>
      `Lab timetable: ${ev.title} (${ev.subject}, ${formatHourRange(ev.startHour, ev.endHour)}, ${ev.eventType})`
  );
}

export async function createBooking(input: {
  equipmentId: string;
  studentId: string;
  projectId?: string;
  start: string;
  end: string;
  purpose: string;
  notes?: string;
  usageType?: UsageType;
  borrowPurpose?: BorrowPurpose;
  expectedReturnAt?: string;
  competition?: Partial<CompetitionDetails> & Pick<CompetitionDetails, "name" | "organiser" | "date">;
}) {
  const state = await ensureLoaded();
  const equipment = state.equipment.find((e) => e.id === input.equipmentId);
  if (!equipment) throw new Error("Equipment not found");
  if (["MAINTENANCE", "QUARANTINED", "RETIRED", "BORROWED"].includes(equipment.status)) {
    throw new Error("Equipment is not available");
  }

  const usageType: UsageType = input.usageType || "IN_LAB";
  if (usageType === "BORROW" && !equipment.borrowable) {
    throw new Error("This equipment cannot leave the laboratory — use in-lab booking instead");
  }

  const student = state.users.find((u) => u.id === input.studentId);
  if (!student) throw new Error("Student not found");
  if (student.fineBalance > 0) {
    throw new Error("Outstanding fines must be cleared before new bookings");
  }

  const lab = state.labs.find((l) => l.id === equipment.labId)!;
  const certified = new Set(
    (state.trainingRecords || [])
      .filter((t) => t.userId === input.studentId && t.status === "CERTIFIED")
      .map((t) => t.trainingId)
  );
  const required = [...(lab.requiredTrainings || []), ...(equipment.requiresTrainingIds || [])];
  const missing = required.filter((t) => !certified.has(t));
  if (missing.length) {
    throw new Error(`Missing required training: ${missing.join(", ")}`);
  }

  const conflicts = await findConflicts(input.equipmentId, input.start, input.end);
  const qtyReserved = Math.max(1, (input as { quantityReserved?: number }).quantityReserved || 1);
  const unitCapacity = equipment.units?.length || equipment.maxConcurrent || 1;
  if (conflicts.length + qtyReserved > unitCapacity && conflicts.length >= equipment.maxConcurrent) {
    throw new Error("Scheduling conflict — slot already booked. Join waitlist or pick another time.");
  }

  const ttHits = timetableConflictsForLab(state, equipment.labId, input.start, input.end);
  const examHits = ttHits.filter((h) => h.includes("EXAM"));
  if (usageType === "BORROW" && examHits.length) {
    throw new Error(
      "Borrowing blocked: requested custody overlaps a protected practical examination on this lab's timetable."
    );
  }

  const windowEnd = usageType === "BORROW" && input.expectedReturnAt ? input.expectedReturnAt : input.end;
  const examUnits = examUnitReservations(state, input.equipmentId, input.start, windowEnd);
  if (examUnits > 0 && usageType === "BORROW") {
    const free = availableUnits(state, input.equipmentId, input.start, windowEnd).length;
    const borrowableSlots = Math.max(0, free - examUnits);
    if (borrowableSlots < qtyReserved) {
      throw new Error(
        "Borrowing blocked: remaining units are reserved for a practical examination. Pick a window that avoids the exam, or choose shorter dates."
      );
    }
  }
  let competition: CompetitionDetails | undefined;
  if (usageType === "BORROW") {
    if (!input.borrowPurpose) throw new Error("Borrow purpose is required");
    if (!input.expectedReturnAt) throw new Error("Expected return date is required for borrowing");
    const maxDays = state.policies?.maxBorrowDurationDays ?? 7;
    const durationDays =
      (+new Date(input.expectedReturnAt) - +new Date(input.start)) / (24 * 60 * 60 * 1000);
    if (durationDays > maxDays + 0.01) {
      throw new Error(`Borrow duration exceeds institutional maximum of ${maxDays} days`);
    }
    // Explore no longer collects projectId — COLLEGE_PROJECT must not require a linked project.
    const evidence = state.policies?.evidenceRequirements;
    if (input.borrowPurpose === "COMPETITION") {
      if (!input.competition?.name || !input.competition.organiser || !input.competition.date) {
        throw new Error("Competition name, organiser and date are mandatory");
      }
      if (evidence?.competitionWebsiteRequired && !input.competition.website) {
        throw new Error("Policy requires a competition website URL");
      }
      if (evidence?.selectionEvidenceRequired && !input.competition.selectionEvidenceNote) {
        throw new Error("Policy requires selection/invitation evidence notes");
      }
      const verified = await verifyCompetition({
        name: input.competition.name,
        organiser: input.competition.organiser,
        date: input.competition.date,
        website: input.competition.website,
      });
      competition = {
        name: input.competition.name,
        organiser: input.competition.organiser,
        date: input.competition.date,
        website: input.competition.website,
        selectionEvidenceNote: input.competition.selectionEvidenceNote,
        projectDescription: input.competition.projectDescription,
        verificationStatus: verified.verificationStatus,
        verificationNotes: verified.verificationNotes,
        verificationEngine: verified.verificationEngine,
        verificationConfidence: verified.verificationConfidence,
        verificationSources: verified.verificationSources,
        verificationLevel: verified.verificationLevel,
        aiPriorityReason: verified.aiPriorityReason,
        participationProofRequested: false,
        participationProofSubmitted: false,
      };
    }
  }

  const endIso = usageType === "BORROW" && input.expectedReturnAt ? input.expectedReturnAt : input.end;
  const unit = pickUnit(state, input.equipmentId, input.start, endIso);

  const needsApproval = equipment.requiresApproval || usageType === "BORROW";
  const booking: Booking = {
    id: uid("bk"),
    equipmentId: input.equipmentId,
    labId: equipment.labId,
    studentId: input.studentId,
    projectId: input.projectId,
    usageType,
    start: input.start,
    end: endIso,
    expectedReturnAt: input.expectedReturnAt,
    status: needsApproval ? (competition?.verificationStatus === "UNABLE_TO_VERIFY" ? "NEEDS_INFO" : "PENDING") : "APPROVED",
    purpose: input.purpose,
    notes: input.notes,
    borrowPurpose: input.borrowPurpose,
    competition,
    assignedUnitId: unit?.id,
    quantityReserved: qtyReserved,
    facultyApproverId: needsApproval ? undefined : lab.managerId,
    approvalNote: needsApproval
      ? undefined
      : ttHits.length
        ? `Auto-approved. Note: timetable overlap candidate — ${ttHits[0]}`
        : "Auto-approved (no faculty gate).",
    createdAt: new Date().toISOString(),
  };
  state.bookings.unshift(booking);

  pushNotification(state, {
    userId: input.studentId,
    title: usageType === "BORROW" ? "Borrow request submitted" : "In-lab booking submitted",
    body: `${equipment.name} · status ${booking.status}`,
    kind: "REQUEST_SUBMITTED",
    relatedBookingId: booking.id,
  });

  const manager = state.users.find((u) => u.id === lab.managerId);
  if (manager) {
    pushNotification(state, {
      userId: manager.id,
      title: usageType === "BORROW" ? "New borrow request" : "New in-lab request",
      body: `${student.name} · ${equipment.name}`,
      kind: "REQUEST_SUBMITTED",
      relatedBookingId: booking.id,
    });
  }

  await persist();
  return { booking, timetableWarnings: ttHits };
}

export async function decideBooking(
  bookingId: string,
  decision: "APPROVED" | "REJECTED" | "NEEDS_INFO",
  approverId: string,
  note?: string
) {
  const state = await ensureLoaded();
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new Error("Booking not found");
  if (!["PENDING", "AI_REVIEW", "NEEDS_INFO"].includes(booking.status)) {
    throw new Error("Booking is not awaiting a decision");
  }

  const approver = state.users.find((u) => u.id === approverId);
  assertCanManageLab(approver, booking.labId);

  if (decision === "NEEDS_INFO") {
    booking.status = "NEEDS_INFO";
    booking.approvalNote = note || "More information required";
  } else if (decision === "APPROVED") {
    booking.status = booking.usageType === "BORROW" ? "READY_FOR_COLLECTION" : "APPROVED";
    booking.approvalNote = note || "Approved";
  } else {
    booking.status = "REJECTED";
    booking.approvalNote = note || "Rejected";
  }
  booking.facultyApproverId = approverId;

  appendAudit(
    state,
    decision === "APPROVED" ? "APPROVAL" : decision === "REJECTED" ? "REJECT" : "OVERRIDE",
    approver,
    `${decision} booking ${booking.id}`,
    { bookingId: booking.id, decision }
  );

  pushNotification(state, {
    userId: booking.studentId,
    title: `Request ${decision.toLowerCase().replace("_", " ")}`,
    body: booking.approvalNote || "",
    kind: `REQUEST_${decision}`,
    relatedBookingId: booking.id,
  });

  await persist();
  return booking;
}

export async function checkInOut(
  bookingId: string,
  action: "IN" | "OUT" | "HANDOVER" | "RETURN_INSPECT",
  returnCondition?: Booking["returnCondition"],
  actorId?: string,
  extras?: {
    checklist?: ChecklistLine[];
    photoUrls?: string[];
    conditionNotes?: string;
  }
) {
  const state = await ensureLoaded();
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new Error("Booking not found");

  const actor = actorId ? state.users.find((u) => u.id === actorId) : null;
  if (actor && actor.role !== "STUDENT") assertCanManageLab(actor, booking.labId);

  if (action === "HANDOVER" || (action === "IN" && booking.usageType === "BORROW")) {
    if (!["APPROVED", "READY_FOR_COLLECTION"].includes(booking.status)) {
      throw new Error("Borrowing is not ready for handover");
    }
    booking.status = "BORROWED";
    booking.handoverAt = new Date().toISOString();
    booking.checkedInAt = booking.handoverAt;
    if (extras?.checklist) booking.handoverChecklist = extras.checklist;
    if (extras?.photoUrls) booking.handoverPhotoUrls = extras.photoUrls;
    if (extras?.conditionNotes) booking.handoverConditionNotes = extras.conditionNotes;
    const eq = state.equipment.find((e) => e.id === booking.equipmentId);
    if (eq) {
      if (!booking.assignedUnitId && eq.units?.length) {
        const unit = pickUnit(state, eq.id, booking.start, booking.end);
        if (unit) booking.assignedUnitId = unit.id;
      }
      if (booking.assignedUnitId && eq.units) {
        const unit = eq.units.find((u) => u.id === booking.assignedUnitId);
        if (unit) unit.status = "BORROWED";
      } else {
        eq.status = "BORROWED";
      }
    }
    appendAudit(state, "HANDOVER", actor, `Handover for ${booking.id}`, {
      bookingId: booking.id,
      unitId: booking.assignedUnitId,
    });
  } else if (action === "IN") {
    if (!["APPROVED", "ACTIVE"].includes(booking.status)) throw new Error("Cannot check in");
    booking.status = "ACTIVE";
    booking.checkedInAt = new Date().toISOString();
    const eq = state.equipment.find((e) => e.id === booking.equipmentId);
    if (eq) {
      if (booking.assignedUnitId && eq.units) {
        const unit = eq.units.find((u) => u.id === booking.assignedUnitId);
        if (unit) unit.status = "IN_USE";
      } else {
        eq.status = "IN_USE";
      }
    }
  } else {
    if (!["ACTIVE", "BORROWED", "OVERDUE", "RETURN_INSPECTION"].includes(booking.status)) {
      throw new Error("Booking is not active/borrowed");
    }
    const isBorrow = booking.usageType === "BORROW";
    if (extras?.checklist) booking.returnChecklist = extras.checklist;
    if (extras?.photoUrls) booking.returnPhotoUrls = extras.photoUrls;
    if (extras?.conditionNotes) booking.returnConditionNotes = extras.conditionNotes;

    if (isBorrow && state.policies?.requireReturnChecklistComplete) {
      const eq = state.equipment.find((e) => e.id === booking.equipmentId);
      const required = (eq?.accessoryChecklist || []).filter((a) => a.required);
      const lines = booking.returnChecklist || extras?.checklist || [];
      const missing = required.filter((r) => !lines.find((l) => l.accessoryId === r.id && l.present));
      if (missing.length) {
        throw new Error(`Return checklist incomplete: ${missing.map((m) => m.label).join(", ")}`);
      }
    }

    booking.status = isBorrow ? "RETURN_INSPECTION" : "COMPLETED";
    booking.checkedOutAt = new Date().toISOString();
    booking.returnCondition = returnCondition || "GOOD";
    if (isBorrow && (returnCondition === "GOOD" || returnCondition === "FAIR") && action === "RETURN_INSPECT") {
      booking.status = "CLOSED";
    } else if (isBorrow && returnCondition === "GOOD" && action === "OUT" && extras?.checklist) {
      booking.status = "CLOSED";
    }
    const eq = state.equipment.find((e) => e.id === booking.equipmentId);
    if (eq) {
      const quarantined = returnCondition === "LOST" || returnCondition === "DAMAGED";
      if (booking.assignedUnitId && eq.units) {
        const unit = eq.units.find((u) => u.id === booking.assignedUnitId);
        if (unit) {
          unit.status = quarantined ? "QUARANTINED" : "AVAILABLE";
          if (quarantined) unit.condition = String(returnCondition);
        }
        if (!eq.units.some((u) => ["BORROWED", "IN_USE", "RESERVED"].includes(u.status))) {
          eq.status = quarantined ? "QUARANTINED" : "AVAILABLE";
        }
      } else {
        eq.status = quarantined ? "QUARANTINED" : "AVAILABLE";
      }
      if (quarantined) {
        eq.conditionNotes = `Returned as ${returnCondition} on ${booking.checkedOutAt}`;
      }
    }
    appendAudit(state, "RETURN", actor, `Return/inspection for ${booking.id}`, {
      bookingId: booking.id,
      returnCondition,
    });
    if (isBorrow && booking.competition) {
      booking.competition.participationProofRequested = true;
      pushNotification(state, {
        userId: booking.studentId,
        title: "Submit competition participation proof",
        body: "Equipment returned — upload participation certificate when the event concludes.",
        kind: "COMPETITION_FOLLOWUP",
        relatedBookingId: booking.id,
      });
    }
  }
  await persist();
  return booking;
}

export async function reportIncident(input: {
  bookingId: string;
  reportedById: string;
  type: Incident["type"];
  description: string;
  severity: Incident["severity"];
  fineAmount?: number;
  fineReason?: string;
}) {
  const state = await ensureLoaded();
  const booking = state.bookings.find((b) => b.id === input.bookingId);
  if (!booking) throw new Error("Booking not found");

  const reporter = state.users.find((u) => u.id === input.reportedById);
  assertCanManageLab(reporter, booking.labId);

  const incident: Incident = {
    id: uid("inc"),
    bookingId: booking.id,
    equipmentId: booking.equipmentId,
    studentId: booking.studentId,
    reportedById: input.reportedById,
    type: input.type,
    description: input.description,
    severity: input.severity,
    createdAt: new Date().toISOString(),
  };
  state.incidents.unshift(incident);

  const eq = state.equipment.find((e) => e.id === booking.equipmentId);
  if (eq) {
    eq.status = input.type === "LOST" ? "RETIRED" : "QUARANTINED";
    eq.conditionNotes = input.description;
  }

  let fine: Fine | null = null;
  if (typeof input.fineAmount === "number" && input.fineAmount > 0) {
    fine = {
      id: uid("fine"),
      incidentId: incident.id,
      studentId: booking.studentId,
      equipmentId: booking.equipmentId,
      amount: input.fineAmount,
      reason: input.fineReason || `${input.type} incident fine`,
      status: "PENDING",
      setById: input.reportedById,
      paidAmount: 0,
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    };
    state.fines.unshift(fine);
    const student = state.users.find((u) => u.id === booking.studentId);
    if (student) student.fineBalance += input.fineAmount;
    pushNotification(state, {
      userId: booking.studentId,
      title: "Fine assessed",
      body: fine.reason,
      kind: "FINE",
      relatedBookingId: booking.id,
    });
  }

  await persist();
  return { incident, fine };
}

export async function updateFine(
  fineId: string,
  patch: { status?: Fine["status"]; amount?: number; paidAmount?: number; reason?: string },
  actor?: User | null
) {
  const state = await ensureLoaded();
  const fine = state.fines.find((f) => f.id === fineId);
  if (!fine) throw new Error("Fine not found");

  if (actor && actor.role !== "STUDENT") {
    const eq = state.equipment.find((e) => e.id === fine.equipmentId);
    if (eq) assertCanManageLab(actor, eq.labId);
  }

  const student = state.users.find((u) => u.id === fine.studentId);
  const prevOutstanding = fine.amount - fine.paidAmount;

  if (typeof patch.amount === "number") fine.amount = patch.amount;
  if (typeof patch.paidAmount === "number") fine.paidAmount = patch.paidAmount;
  if (patch.reason) fine.reason = patch.reason;
  if (patch.status) fine.status = patch.status;
  if (fine.status === "WAIVED") fine.paidAmount = fine.amount;
  if (fine.paidAmount >= fine.amount && fine.status !== "WAIVED") fine.status = "PAID";

  const newOutstanding = fine.status === "WAIVED" ? 0 : Math.max(0, fine.amount - fine.paidAmount);
  if (student) {
    student.fineBalance = Math.max(0, student.fineBalance - prevOutstanding + newOutstanding);
  }
  await persist();
  return fine;
}

export async function addWaitlist(input: Omit<WaitlistEntry, "id" | "createdAt">) {
  const state = await ensureLoaded();
  const entry: WaitlistEntry = {
    ...input,
    id: uid("wl"),
    createdAt: new Date().toISOString(),
  };
  state.waitlist.push(entry);
  await persist();
  return entry;
}

export async function resolveConflict(
  bookingId: string,
  action: "KEEP" | "SHIFT" | "CANCEL",
  actorId: string
) {
  const state = await ensureLoaded();
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new Error("Booking not found");
  const actor = state.users.find((u) => u.id === actorId);
  assertCanManageLab(actor, booking.labId);

  const conflicts = await findConflicts(booking.equipmentId, booking.start, booking.end, booking.id);

  if (action === "CANCEL") {
    booking.status = "CANCELLED";
    booking.conflictResolvedBy = actorId;
    booking.approvalNote = (booking.approvalNote || "") + " | Cancelled to resolve conflict";
  } else if (action === "SHIFT") {
    const end = new Date(booking.end);
    const start = new Date(booking.start);
    const duration = +end - +start;
    const newStart = new Date(+end + 30 * 60 * 1000);
    booking.start = newStart.toISOString();
    booking.end = new Date(+newStart + duration).toISOString();
    booking.conflictResolvedBy = actorId;
    booking.approvalNote = (booking.approvalNote || "") + " | Auto-shifted by 30m after conflict";
  } else {
    for (const c of conflicts) {
      if (c.status === "PENDING" || c.status === "NEEDS_INFO") {
        if (!canManageLab(actor, c.labId)) continue;
        c.status = "REJECTED";
        c.approvalNote = "Superseded — conflicting higher-priority booking retained";
        c.conflictResolvedBy = actorId;
      }
    }
    booking.conflictResolvedBy = actorId;
  }
  await persist();
  return {
    booking,
    remainingConflicts: await findConflicts(booking.equipmentId, booking.start, booking.end, booking.id),
  };
}

export async function getDashboardStats(actor?: User | null) {
  const state = await ensureLoaded();
  let labs = state.labs;
  let equipment = state.equipment;
  let bookings = state.bookings;
  let fines = state.fines;
  let incidents = state.incidents;

  if (actor && actor.role !== "STUDENT" && !isCampusWide(actor)) {
    labs = await listLabs(actor);
    const labSet = new Set(labs.map((l) => l.id));
    equipment = equipment.filter((e) => labSet.has(e.labId));
    bookings = bookings.filter((b) => labSet.has(b.labId));
    const eqIds = new Set(equipment.map((e) => e.id));
    fines = fines.filter((f) => eqIds.has(f.equipmentId));
    incidents = incidents.filter((i) => eqIds.has(i.equipmentId));
  }

  const pending = bookings.filter((b) => ["PENDING", "NEEDS_INFO", "AI_REVIEW"].includes(b.status)).length;
  const active = bookings.filter((b) => ["ACTIVE", "BORROWED"].includes(b.status)).length;
  const available = equipment.filter((e) => e.status === "AVAILABLE").length;
  const quarantined = equipment.filter((e) => e.status === "QUARANTINED" || e.status === "MAINTENANCE").length;
  const outstandingFines = fines
    .filter((f) => f.status === "PENDING" || f.status === "PARTIAL")
    .reduce((s, f) => s + (f.amount - f.paidAmount), 0);
  const utilization = labs.reduce((s, l) => s + l.utilizationPct, 0) / Math.max(1, labs.length);

  const byCategory = labs.reduce<Record<string, number>>((acc, lab) => {
    acc[lab.category] = (acc[lab.category] || 0) + 1;
    return acc;
  }, {});

  return {
    pending,
    active,
    available,
    quarantined,
    outstandingFines,
    utilization: Math.round(utilization),
    labCount: labs.length,
    equipmentCount: equipment.length,
    byCategory,
    recentIncidents: incidents.slice(0, 5),
    scoped: !!(actor && actor.role !== "STUDENT" && !isCampusWide(actor)),
    managedLabIds: actor?.managedLabIds || null,
  };
}

export async function listFines(studentId?: string, actor?: User | null) {
  const state = await ensureLoaded();
  let items = state.fines;
  if (studentId) items = items.filter((f) => f.studentId === studentId);
  if (actor && actor.role !== "STUDENT" && !isCampusWide(actor)) {
    const eqIds = new Set((await listEquipment({}, actor)).map((e) => e.id));
    items = items.filter((f) => eqIds.has(f.equipmentId));
  }
  return items.map((f) => ({
    ...f,
    student: state.users.find((u) => u.id === f.studentId)!,
    equipment: state.equipment.find((e) => e.id === f.equipmentId)!,
  }));
}

export async function listProjects(studentId?: string) {
  const state = await ensureLoaded();
  let items = state.projects;
  if (studentId) items = items.filter((p) => p.studentId === studentId);
  return items;
}

export async function listUsers() {
  return (await ensureLoaded()).users;
}

export async function listTrainings() {
  const state = await ensureLoaded();
  return { catalog: state.trainings, records: state.trainingRecords };
}

/**
 * Lab / ops timetable listing.
 * - With labId + no staff actor: booking/explore visibility — all published events for that lab.
 * - Faculty/ADMIN: managed labs (and events where they are the assigned facultyId).
 * - Coordinator / SUPER_ADMIN: campus-wide.
 */
export async function listTimetable(
  labId?: string,
  actor?: User | null,
  opts?: { forBooking?: boolean; publishedOnly?: boolean }
) {
  const state = await ensureLoaded();
  let events = state.timetable;
  const publishedOnly =
    opts?.publishedOnly ?? (opts?.forBooking || !actor || actor.role === "STUDENT");

  if (labId) events = events.filter((e) => e.labId === labId);
  if (publishedOnly) events = events.filter((e) => e.published !== false);

  if (opts?.forBooking) {
    // Any authenticated student may inspect a lab schedule while booking/borrowing.
  } else if (actor && (actor.role === "TIMETABLE_COORDINATOR" || isCampusWide(actor))) {
    // Campus-wide timetable ops.
  } else if (actor && actor.role !== "STUDENT") {
    if (labId) {
      const scope = managedLabIds(actor) || [];
      const manages = canManageLab(actor, labId) || scope.includes(labId);
      if (!manages) {
        // Still allow teachers to see sessions where they are the assigned class faculty.
        events = events.filter((e) => e.facultyId === actor.id);
      }
    } else {
      const scope = managedLabIds(actor) || [];
      events = events.filter(
        (e) => scope.includes(e.labId) || e.facultyId === actor.id
      );
    }
  } else if (actor?.role === "STUDENT" && !labId) {
    throw new Error("Students must request My Timetable (studentId) or a lab schedule (labId)");
  }

  return events
    .map((e) => ({
      ...e,
      lab: state.labs.find((l) => l.id === e.labId)!,
      faculty: state.users.find((u) => u.id === e.facultyId),
      classKey: e.classKey || makeClassKey(e.labId, e.subject, e.cohort),
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startHour - b.startHour);
}

/** Distinct subject/cohort options for a lab from enrolments + existing timetable rows. */
export async function listLabClassOptions(labId: string) {
  const state = await ensureLoaded();
  if (!state.labs.some((l) => l.id === labId)) throw new Error("Lab not found");
  const map = new Map<
    string,
    {
      subject: string;
      cohort: string;
      facultyId?: string;
      classKey: string;
      source: "enrollment" | "timetable";
    }
  >();
  for (const en of state.enrollments.filter((e) => e.labId === labId)) {
    const key = enrollmentClassKey(en);
    if (!map.has(key)) {
      map.set(key, {
        subject: en.subject,
        cohort: en.cohort,
        facultyId: en.facultyId,
        classKey: key,
        source: "enrollment",
      });
    }
  }
  for (const t of state.timetable.filter((e) => e.labId === labId)) {
    if (isGeneralTimetableCohort(t.cohort)) continue;
    const key = t.classKey || makeClassKey(t.labId, t.subject, t.cohort);
    if (!map.has(key)) {
      map.set(key, {
        subject: t.subject,
        cohort: t.cohort,
        facultyId: t.facultyId,
        classKey: key,
        source: "timetable",
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => a.subject.localeCompare(b.subject) || a.cohort.localeCompare(b.cohort)
  );
}

function enrollmentClassKey(en: { labId: string; subject: string; cohort: string }) {
  return makeClassKey(en.labId, en.subject, en.cohort);
}

/** True when a published event belongs to the student's enrolled class (not other labs/classes). */
function eventVisibleOnMyTimetable(
  ev: TimetableEvent,
  en: { labId: string; subject: string; cohort: string }
) {
  if (ev.published === false) return false;
  if (isGeneralTimetableCohort(ev.cohort)) return false;
  const key = ev.classKey || makeClassKey(ev.labId, ev.subject, ev.cohort);
  return key === enrollmentClassKey(en);
}

/**
 * My Lab Timetable — only sessions for classes the student is enrolled in.
 * Other labs' schedules are available via booking/explore (`listTimetable` + labId).
 */
export async function getStudentLabTimetable(studentId: string) {
  const state = await ensureLoaded();
  const mine = state.enrollments.filter((e) => e.studentId === studentId);
  const rows = mine.flatMap((en) => {
    const matching = state.timetable.filter((t) => eventVisibleOnMyTimetable(t, en));
    const lab = state.labs.find((l) => l.id === en.labId)!;
    if (!matching.length) {
      return [
        {
          enrollment: en,
          lab,
          event: null as (typeof state.timetable)[0] | null,
        },
      ];
    }
    return matching.map((event) => ({ enrollment: en, lab, event }));
  });
  return {
    enrollments: mine.map((en) => ({
      ...en,
      lab: state.labs.find((l) => l.id === en.labId)!,
      faculty: state.users.find((u) => u.id === en.facultyId),
      classKey: enrollmentClassKey(en),
    })),
    schedule: rows,
  };
}

export async function listNotifications(userId: string) {
  const state = await ensureLoaded();
  return state.notifications.filter((n) => n.userId === userId);
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const state = await ensureLoaded();
  const n = state.notifications.find((x) => x.id === notificationId && x.userId === userId);
  if (!n) throw new Error("Notification not found");
  n.read = true;
  await persist();
  return n;
}

export async function listIncidents(actor?: User | null) {
  const state = await ensureLoaded();
  let items = state.incidents;
  if (actor && actor.role !== "STUDENT" && !isCampusWide(actor)) {
    const eqIds = new Set((await listEquipment({}, actor)).map((e) => e.id));
    items = items.filter((i) => eqIds.has(i.equipmentId));
  }
  return items.map((i) => ({
    ...i,
    equipment: state.equipment.find((e) => e.id === i.equipmentId),
    student: state.users.find((u) => u.id === i.studentId),
  }));
}

export async function scanOverdue() {
  const state = await ensureLoaded();
  const now = Date.now();
  const graceMs = (state.policies?.overdueGraceHours ?? 0) * 60 * 60 * 1000;
  const marked: string[] = [];
  for (const b of state.bookings) {
    if (b.status !== "BORROWED" || !b.expectedReturnAt) continue;
    if (+new Date(b.expectedReturnAt) + graceMs >= now) continue;
    b.status = "OVERDUE";
    marked.push(b.id);
    pushNotification(state, {
      userId: b.studentId,
      title: "Borrow overdue",
      body: `Equipment custody past expected return (${b.equipmentId}). Return promptly.`,
      kind: "OVERDUE",
      relatedBookingId: b.id,
    });
  }
  if (marked.length) await persist();
  return { marked };
}

export async function listOverdue(actor?: User | null) {
  await scanOverdue();
  return listBookings({ status: "OVERDUE" }, actor);
}

export async function upsertTimetableEvent(
  input: Omit<TimetableEvent, "id"> & { id?: string },
  actor: User
) {
  const state = await ensureLoaded();
  if (!input.labId) throw new Error("Lab is required");
  assertCanManageTimetable(actor, input.labId);
  if (!state.labs.some((l) => l.id === input.labId)) throw new Error("Lab not found");

  const startHour = Number(input.startHour);
  const endHour = Number(input.endHour);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) {
    throw new Error("Start and end time are required");
  }
  if (endHour <= startHour) throw new Error("End time must be after start time");

  let dayOfWeek = Number(input.dayOfWeek);
  let eventDate = input.eventDate?.trim() || undefined;
  if (eventDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      throw new Error("Event date must be YYYY-MM-DD");
    }
    const [y, m, d] = eventDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime()) || localDateString(dt) !== eventDate) {
      throw new Error("Invalid event date");
    }
    dayOfWeek = dt.getDay();
  } else if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error("Day of week is required for recurring sessions");
  }

  const title = (input.title || "").trim();
  const subject = (input.subject || "").trim();
  const cohort = (input.cohort || "").trim();
  if (!title) throw new Error("Title is required");
  if (!subject) throw new Error("Class / subject is required");
  if (!cohort) throw new Error("Cohort is required");

  const allowedTypes: TimetableEvent["eventType"][] = [
    "CLASS",
    "SPECIAL",
    "EXAM",
    "MAINTENANCE",
    "HOLIDAY",
  ];
  if (!allowedTypes.includes(input.eventType)) throw new Error("Invalid event type");

  const classKey = makeClassKey(input.labId, subject, cohort);
  const payload: Omit<TimetableEvent, "id"> & { id?: string } = {
    ...input,
    title,
    subject,
    cohort,
    startHour,
    endHour,
    dayOfWeek,
    eventDate,
    classKey,
    notes: input.notes?.trim() || undefined,
    published: input.published ?? true,
  };

  let event: TimetableEvent;
  if (payload.id) {
    const existing = state.timetable.find((t) => t.id === payload.id);
    if (!existing) throw new Error("Timetable event not found");
    Object.assign(existing, { ...payload, id: existing.id });
    event = existing;
  } else {
    event = { ...payload, id: uid("tt"), published: payload.published ?? true };
    state.timetable.push(event);
  }
  appendAudit(state, "TIMETABLE_EDIT", actor, `${payload.id ? "Updated" : "Created"} timetable ${event.title}`, {
    eventId: event.id,
    labId: event.labId,
  });
  await persist();
  return event;
}

export async function deleteTimetableEvent(eventId: string, actor: User) {
  const state = await ensureLoaded();
  const idx = state.timetable.findIndex((t) => t.id === eventId);
  if (idx < 0) throw new Error("Event not found");
  assertCanManageTimetable(actor, state.timetable[idx].labId);
  const [removed] = state.timetable.splice(idx, 1);
  appendAudit(state, "TIMETABLE_EDIT", actor, `Deleted timetable ${removed.title}`, { eventId });
  await persist();
  return removed;
}

export async function getPolicies() {
  return (await ensureLoaded()).policies;
}

export async function updatePolicies(patch: Partial<PolicyConfig>, actor: User) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Only central admin can edit policies");
  const state = await ensureLoaded();
  state.policies = {
    ...state.policies,
    ...patch,
    priorityWeights: { ...state.policies.priorityWeights, ...(patch.priorityWeights || {}) },
    evidenceRequirements: {
      ...state.policies.evidenceRequirements,
      ...(patch.evidenceRequirements || {}),
    },
  };
  appendAudit(state, "POLICY_CHANGE", actor, "Updated institutional policies", patch as Record<string, unknown>);
  await persist();
  return state.policies;
}

export async function listAuditLog(type?: AuditEventType) {
  const state = await ensureLoaded();
  let items = state.auditLog;
  if (type) items = items.filter((a) => a.type === type);
  return items.slice(0, 200);
}

export async function listProgrammes() {
  return (await ensureLoaded()).programmes;
}

export async function previewStudentCsv(csvText: string) {
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV needs a header and at least one row");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = [
    "student_id",
    "name",
    "email",
    "department",
    "programme",
    "batch",
    "semester",
    "section",
    "lab_enrolments",
  ];
  for (const r of required) {
    if (!headers.includes(r)) throw new Error(`Missing CSV column: ${r}`);
  }
  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const get = (key: string) => cols[headers.indexOf(key)]?.trim() || "";
    return {
      studentId: get("student_id"),
      name: get("name"),
      email: get("email"),
      department: get("department"),
      programme: get("programme"),
      batch: get("batch"),
      semester: Number(get("semester") || 0),
      section: get("section"),
      labEnrolments: get("lab_enrolments"),
      errors: [] as string[],
    };
  });
  for (const row of rows) {
    if (!row.studentId) row.errors.push("student_id required");
    if (!row.email.includes("@")) row.errors.push("invalid email");
    if (!row.semester) row.errors.push("semester required");
  }
  return { headers, rows, valid: rows.every((r) => !r.errors.length) };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export async function importStudentCsv(csvText: string, actor: User) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Only central admin can import students");
  const preview = await previewStudentCsv(csvText);
  if (!preview.valid) throw new Error("Fix validation errors before import");
  const state = await ensureLoaded();
  let created = 0;
  let updated = 0;
  for (const row of preview.rows) {
    let user = state.users.find((u) => u.rollNumber === row.studentId || u.email === row.email);
    const programme = state.programmes.find(
      (p) => p.name.toLowerCase() === row.programme.toLowerCase()
    );
    if (!user) {
      user = {
        id: uid("u"),
        name: row.name,
        email: row.email,
        role: "STUDENT",
        department: row.department,
        programme: row.programme,
        programmeId: programme?.id,
        year: Math.ceil(row.semester / 2),
        semester: row.semester,
        section: row.section,
        batch: row.batch,
        rollNumber: row.studentId,
        academicStanding: "ACTIVE",
        avatarColor: "#0f766e",
        certifications: ["lab-safety-core"],
        fineBalance: 0,
        createdAt: new Date().toISOString(),
      };
      state.users.push(user);
      created++;
    } else {
      user.name = row.name;
      user.email = row.email;
      user.department = row.department;
      user.programme = row.programme;
      user.programmeId = programme?.id || user.programmeId;
      user.semester = row.semester;
      user.section = row.section;
      user.batch = row.batch;
      user.rollNumber = row.studentId;
      updated++;
    }
    // Replace enrolments for this student from CSV cell: labId|subject|cohort;...
    state.enrollments = state.enrollments.filter((e) => e.studentId !== user!.id);
    const parts = row.labEnrolments.split(";").map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const [labId, subject, cohort] = part.split("|").map((s) => s.trim());
      if (!labId) continue;
      const lab = state.labs.find((l) => l.id === labId || l.code === labId);
      if (!lab) continue;
      state.enrollments.push({
        id: uid("en"),
        studentId: user.id,
        labId: lab.id,
        subject: subject || "Practical",
        cohort: cohort || `${row.programme} Sem ${row.semester}`,
        facultyId: lab.managerId,
        academicYear: programme?.currentAcademicYear || "2025-26",
        semester: row.semester,
      });
    }
  }
  appendAudit(state, "IMPORT", actor, `Imported ${created} new / ${updated} updated students from CSV`, {
    created,
    updated,
  });
  await persist();
  return { created, updated, total: preview.rows.length };
}

export async function getSampleCsv() {
  return (await ensureLoaded()).sampleCsv || SAMPLE_CSV;
}

export async function progressStudent(
  studentId: string,
  action: "PROMOTE" | "BACKLOG" | "CORRECT",
  actor: User,
  patch?: { semester?: number; year?: number; academicStanding?: User["academicStanding"]; backlogSemesters?: number[] }
) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Only central admin can change academic progression");
  const state = await ensureLoaded();
  const student = state.users.find((u) => u.id === studentId && u.role === "STUDENT");
  if (!student) throw new Error("Student not found");
  if (action === "PROMOTE") {
    student.semester = Math.min(8, (student.semester || 1) + 1);
    student.year = Math.ceil(student.semester / 2);
    student.academicStanding = "ACTIVE";
  } else if (action === "BACKLOG") {
    student.academicStanding = "BACKLOG";
    const sem = student.semester || 1;
    student.backlogSemesters = Array.from(new Set([...(student.backlogSemesters || []), sem]));
  } else if (action === "CORRECT" && patch) {
    if (typeof patch.semester === "number") student.semester = patch.semester;
    if (typeof patch.year === "number") student.year = patch.year;
    if (patch.academicStanding) student.academicStanding = patch.academicStanding;
    if (patch.backlogSemesters) student.backlogSemesters = patch.backlogSemesters;
  }
  appendAudit(state, "PROGRESSION", actor, `${action} for ${student.name}`, {
    studentId,
    semester: student.semester,
    standing: student.academicStanding,
  });
  await persist();
  return student;
}

export async function listExperimentBank(labId?: string, actor?: User | null) {
  const state = await ensureLoaded();
  let items = state.experimentBank;
  if (labId) items = items.filter((e) => e.labId === labId);
  if (actor && actor.role !== "STUDENT" && !isCampusWide(actor)) {
    items = filterByManagedLabs(actor, items);
  }
  return items;
}

export async function upsertExperimentBankItem(
  input: Omit<ExperimentBankItem, "id"> & { id?: string },
  actor: User
) {
  assertCanManageLab(actor, input.labId);
  const state = await ensureLoaded();
  if (input.id) {
    const existing = state.experimentBank.find((e) => e.id === input.id);
    if (!existing) throw new Error("Experiment not found");
    Object.assign(existing, { ...input, id: existing.id });
    await persist();
    return existing;
  }
  const item: ExperimentBankItem = { ...input, id: uid("exp") };
  state.experimentBank.push(item);
  await persist();
  return item;
}

export async function listPracticalExams(labId?: string, actor?: User | null) {
  const state = await ensureLoaded();
  let items = state.practicalExams;
  if (labId) items = items.filter((e) => e.labId === labId);
  if (actor && actor.role !== "STUDENT" && !isCampusWide(actor)) {
    items = filterByManagedLabs(actor, items);
  }
  return items.map((ex) => ({
    ...ex,
    lab: state.labs.find((l) => l.id === ex.labId),
    allocations: state.examAllocations.filter((a) => a.examId === ex.id),
  }));
}

export async function createPracticalExam(
  input: Omit<PracticalExam, "id" | "createdAt" | "status"> & { status?: PracticalExam["status"] },
  actor: User
) {
  assertCanManageLab(actor, input.labId);
  const state = await ensureLoaded();
  const exam: PracticalExam = {
    ...input,
    id: uid("exam"),
    status: input.status || "SCHEDULED",
    createdAt: new Date().toISOString(),
  };
  state.practicalExams.unshift(exam);
  appendAudit(state, "EXAM_EDIT", actor, `Created exam ${exam.title}`, { examId: exam.id });
  await persist();
  return exam;
}

export async function startPracticalExam(examId: string, actor: User) {
  const state = await ensureLoaded();
  const exam = state.practicalExams.find((e) => e.id === examId);
  if (!exam) throw new Error("Exam not found");
  assertCanManageLab(actor, exam.labId);
  if (!["DRAFT", "SCHEDULED"].includes(exam.status)) {
    throw new Error("Only scheduled/draft exams can be started");
  }
  exam.status = "LIVE";
  exam.startedAt = new Date().toISOString();
  const allocs = state.examAllocations.filter((a) => a.examId === examId);
  for (const a of allocs) {
    pushNotification(state, {
      userId: a.studentId,
      title: "Practical exam started",
      body: `${exam.title} is now LIVE — open My Examinations to view your experiment.`,
      kind: "EXAM_LIVE",
    });
  }
  appendAudit(state, "EXAM_EDIT", actor, `Started test ${exam.title}`, { examId });
  await persist();
  return exam;
}

export async function endPracticalExam(examId: string, actor: User) {
  const state = await ensureLoaded();
  const exam = state.practicalExams.find((e) => e.id === examId);
  if (!exam) throw new Error("Exam not found");
  assertCanManageLab(actor, exam.labId);
  exam.status = "COMPLETED";
  appendAudit(state, "EXAM_EDIT", actor, `Ended test ${exam.title}`, { examId });
  await persist();
  return exam;
}

export async function allocateExperiment(
  input: Omit<ExamAllocation, "id">,
  actor: User
) {
  const state = await ensureLoaded();
  const exam = state.practicalExams.find((e) => e.id === input.examId);
  if (!exam) throw new Error("Exam not found");
  assertCanManageLab(actor, exam.labId);
  const existing = state.examAllocations.find(
    (a) => a.examId === input.examId && a.studentId === input.studentId
  );
  if (existing) {
    existing.experimentId = input.experimentId;
    existing.groupLabel = input.groupLabel;
    existing.seat = input.seat;
    await persist();
    return existing;
  }
  const alloc: ExamAllocation = { ...input, id: uid("alloc") };
  state.examAllocations.push(alloc);
  appendAudit(state, "EXAM_EDIT", actor, `Allocated experiment for student ${input.studentId}`, {
    examId: input.examId,
  });
  await persist();
  return alloc;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Assign experiments round-robin with shuffled order so counts differ by at most 1. */
function fairExperimentIds(slotCount: number, experimentIds: string[]): string[] {
  const pool = shuffleInPlace([...experimentIds]);
  const out: string[] = [];
  for (let i = 0; i < slotCount; i++) out.push(pool[i % pool.length]);
  return shuffleInPlace(out);
}

export async function listLabExamRoster(labId: string, actor?: User | null) {
  const state = await ensureLoaded();
  if (actor && actor.role !== "STUDENT") assertCanManageLab(actor, labId);
  const studentIds = [
    ...new Set(state.enrollments.filter((e) => e.labId === labId).map((e) => e.studentId)),
  ];
  return studentIds
    .map((id) => state.users.find((u) => u.id === id))
    .filter((u): u is User => !!u && u.role === "STUDENT");
}

/**
 * Randomly allocate selected experiments to enrolled students (individual or groups).
 * Persists one ExamAllocation row per student; returns grouped preview for the UI.
 */
export async function generateExamAllocations(input: ExamGenerateRequest, actor: User) {
  const state = await ensureLoaded();
  const mode: ExamGenerateMode = input.mode === "GROUP" ? "GROUP" : "INDIVIDUAL";

  let exam = input.examId ? state.practicalExams.find((e) => e.id === input.examId) : undefined;
  let labId = exam?.labId || input.labId;
  if (!labId) throw new Error("examId or labId required");
  assertCanManageLab(actor, labId);

  if (!exam) {
    const scheduled = state.practicalExams.find(
      (e) => e.labId === labId && ["DRAFT", "SCHEDULED"].includes(e.status)
    );
    exam = scheduled || state.practicalExams.find((e) => e.labId === labId);
  }
  if (!exam) throw new Error("No practical exam found for this lab — create one first");
  labId = exam.labId;

  if (!input.experimentIds?.length) throw new Error("Select at least one experiment");
  const bankIds = new Set(
    state.experimentBank.filter((e) => e.labId === labId && e.active !== false).map((e) => e.id)
  );
  const experimentIds = input.experimentIds.filter((id) => bankIds.has(id));
  if (!experimentIds.length) throw new Error("No valid experiments for this lab");

  const roster = await listLabExamRoster(labId, actor);
  let students = roster;
  if (input.studentIds?.length) {
    const want = new Set(input.studentIds);
    students = roster.filter((s) => want.has(s.id));
  }
  if (!students.length) throw new Error("No enrolled students for this lab");

  const shuffledStudents = shuffleInPlace([...students]);
  const groups: { studentIds: string[]; groupLabel?: string }[] = [];

  if (mode === "GROUP") {
    const size = Math.max(2, Math.floor(input.groupSize || 2));
    let gi = 1;
    for (let i = 0; i < shuffledStudents.length; i += size) {
      const chunk = shuffledStudents.slice(i, i + size);
      groups.push({
        studentIds: chunk.map((s) => s.id),
        groupLabel: `Group ${gi}`,
      });
      gi += 1;
    }
  } else {
    for (const s of shuffledStudents) {
      groups.push({ studentIds: [s.id] });
    }
  }

  const assigned = fairExperimentIds(groups.length, experimentIds);
  const grouped: ExamAllocationGroup[] = groups.map((g, i) => ({
    studentIds: g.studentIds,
    experimentId: assigned[i],
    groupLabel: g.groupLabel,
  }));

  const flat: ExamAllocation[] = [];
  for (const g of grouped) {
    for (const studentId of g.studentIds) {
      flat.push({
        id: uid("alloc"),
        examId: exam.id,
        studentId,
        experimentId: g.experimentId,
        groupLabel: g.groupLabel,
      });
    }
  }

  const save = input.save === true;
  if (save) {
    state.examAllocations = state.examAllocations.filter((a) => a.examId !== exam!.id);
    state.examAllocations.push(...flat);
    appendAudit(
      state,
      "EXAM_EDIT",
      actor,
      `Generated ${mode.toLowerCase()} experiment list for ${exam.title} (${flat.length} students)`,
      { examId: exam.id, mode, experimentCount: experimentIds.length }
    );
    await persist();
  }

  const experimentsById = Object.fromEntries(
    state.experimentBank.filter((e) => experimentIds.includes(e.id)).map((e) => [e.id, e])
  );

  return {
    exam,
    mode,
    saved: save,
    groups: grouped.map((g) => ({
      ...g,
      students: g.studentIds
        .map((id) => state.users.find((u) => u.id === id))
        .filter((u): u is User => !!u),
      experiment: experimentsById[g.experimentId],
    })),
    allocations: flat,
    roster: students,
  };
}

export async function upsertMark(
  input: Omit<MarkRecord, "id" | "updatedAt" | "published"> & { id?: string; published?: boolean },
  actor: User
) {
  const state = await ensureLoaded();
  const exam = state.practicalExams.find((e) => e.id === input.examId);
  if (!exam) throw new Error("Exam not found");
  assertCanManageLab(actor, exam.labId);
  let record = input.id
    ? state.markRecords.find((m) => m.id === input.id)
    : state.markRecords.find(
        (m) => m.examId === input.examId && m.studentId === input.studentId && m.experimentId === input.experimentId
      );
  if (record) {
    record.marksObtained = input.marksObtained;
    record.maxMarks = input.maxMarks;
    record.remarks = input.remarks;
    record.enteredById = actor.id;
    record.updatedAt = new Date().toISOString();
  } else {
    record = {
      id: uid("mark"),
      examId: input.examId,
      studentId: input.studentId,
      experimentId: input.experimentId,
      marksObtained: input.marksObtained,
      maxMarks: input.maxMarks,
      remarks: input.remarks,
      enteredById: actor.id,
      updatedAt: new Date().toISOString(),
      published: false,
    };
    state.markRecords.push(record);
  }
  appendAudit(state, "MARK_EDIT", actor, `Updated marks for ${input.studentId}`, {
    examId: input.examId,
    marks: input.marksObtained,
  });
  await persist();
  return record;
}

export async function publishExamResults(examId: string, actor: User) {
  const state = await ensureLoaded();
  const exam = state.practicalExams.find((e) => e.id === examId);
  if (!exam) throw new Error("Exam not found");
  assertCanManageLab(actor, exam.labId);
  exam.status = "PUBLISHED";
  exam.publishedAt = new Date().toISOString();
  for (const m of state.markRecords.filter((x) => x.examId === examId)) {
    m.published = true;
    pushNotification(state, {
      userId: m.studentId,
      title: "Exam results published",
      body: `${exam.title} marks are now available in My Results.`,
      kind: "RESULTS_PUBLISHED",
    });
  }
  appendAudit(state, "PUBLICATION", actor, `Published results for ${exam.title}`, { examId });
  await persist();
  return exam;
}

/**
 * Student-facing examinations:
 * - Experiment assignment is revealed ONLY while exam.status === "LIVE".
 * - After end/complete/publish, assignment is hidden from My Examinations.
 */
export async function getStudentExaminations(studentId: string) {
  const state = await ensureLoaded();
  const allocs = state.examAllocations.filter((a) => a.studentId === studentId);
  return allocs
    .map((a) => {
      const exam = state.practicalExams.find((e) => e.id === a.examId);
      if (!exam || exam.status !== "LIVE") return null;
      const experiment = state.experimentBank.find((e) => e.id === a.experimentId);
      return {
        allocation: a,
        exam,
        experiment,
        lab: state.labs.find((l) => l.id === exam.labId),
      };
    })
    .filter(Boolean);
}

/** Published marks only. */
export async function getStudentResults(studentId: string) {
  const state = await ensureLoaded();
  return state.markRecords
    .filter((m) => m.studentId === studentId && m.published)
    .map((m) => ({
      ...m,
      exam: state.practicalExams.find((e) => e.id === m.examId),
      experiment: state.experimentBank.find((e) => e.id === m.experimentId),
    }));
}

export async function listSavedResources(studentId: string) {
  const state = await ensureLoaded();
  return state.savedResources
    .filter((s) => s.studentId === studentId)
    .map((s) => ({
      ...s,
      equipment: s.equipmentId ? state.equipment.find((e) => e.id === s.equipmentId) : undefined,
      lab: s.labId
        ? state.labs.find((l) => l.id === s.labId)
        : s.equipmentId
          ? state.labs.find((l) => l.id === state.equipment.find((e) => e.id === s.equipmentId)?.labId)
          : undefined,
    }));
}

export async function toggleSavedResource(
  input: { studentId: string; equipmentId?: string; labId?: string },
  actor: User
) {
  if (actor.role !== "STUDENT" || actor.id !== input.studentId) {
    throw new Error("Only the student may manage their saved resources");
  }
  const state = await ensureLoaded();
  const existing = state.savedResources.find(
    (s) =>
      s.studentId === input.studentId &&
      s.equipmentId === input.equipmentId &&
      s.labId === input.labId
  );
  if (existing) {
    state.savedResources = state.savedResources.filter((s) => s.id !== existing.id);
    await persist();
    return { saved: false };
  }
  const entry: SavedResource = {
    id: uid("save"),
    studentId: input.studentId,
    equipmentId: input.equipmentId,
    labId: input.labId,
    createdAt: new Date().toISOString(),
  };
  state.savedResources.unshift(entry);
  await persist();
  return { saved: true, entry };
}

export async function runAiAllocation(req: AiAllocationRequest, actor?: User | null): Promise<AiAllocationSuggestion[]> {
  if (actor) {
    if (actor.role === "STUDENT") throw new Error("AI Allocate is available to lab staff only");
    if (actor.role === "TIMETABLE_COORDINATOR") {
      throw new Error("Timetable coordinators do not have AI Allocate access");
    }
    if (!isCampusWide(actor) && !canManageLab(actor, req.labId)) {
      throw new Error("You can only allocate within your assigned labs");
    }
  }
  const state = await ensureLoaded();
  return recommendAllocations(state, req);
}

