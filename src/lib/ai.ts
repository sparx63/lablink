import type {
  AiAllocationRequest,
  AiAllocationSuggestion,
  AppState,
  Booking,
  Equipment,
  Lab,
  PolicyConfig,
  Project,
} from "./types";

const DEFAULT_PRIORITY_WEIGHT: PolicyConfig["priorityWeights"] = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
  COMPETITION_BONUS: 2,
  PERSONAL_PROJECT_PENALTY: 1,
};

function priorityWeights(state: AppState) {
  return state.policies?.priorityWeights || DEFAULT_PRIORITY_WEIGHT;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

function nextOpenSlot(
  lab: Lab,
  equipment: Equipment,
  bookings: Booking[],
  durationHours: number,
  from = new Date()
): { start: string; end: string } | null {
  const durationMs = durationHours * 60 * 60 * 1000;
  const cursor = new Date(from);
  cursor.setMinutes(0, 0, 0);
  if (cursor.getHours() < lab.openHour) cursor.setHours(lab.openHour, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + dayOffset);
    const open = lab.openHour;
    const close = lab.closeHour === 24 ? 24 : lab.closeHour;
    for (let h = open; h < close; h++) {
      const start = new Date(day);
      start.setHours(h, 0, 0, 0);
      if (start < from) continue;
      const end = new Date(+start + durationMs);
      if (lab.closeHour !== 24 && end.getHours() + end.getMinutes() / 60 > close && end.getDate() === start.getDate()) {
        continue;
      }
      const conflicts = bookings.filter(
        (b) =>
          b.equipmentId === equipment.id &&
          !["REJECTED", "CANCELLED", "NO_SHOW"].includes(b.status) &&
          overlaps(b.start, b.end, start.toISOString(), end.toISOString())
      );
      if (conflicts.length < equipment.maxConcurrent) {
        return { start: start.toISOString(), end: end.toISOString() };
      }
    }
  }
  return null;
}

function scoreEquipment(
  state: AppState,
  equipment: Equipment,
  lab: Lab,
  req: AiAllocationRequest,
  project?: Project
): { score: number; rationale: string[]; fairness: string[]; conflicts: string[] } {
  const tokens = new Set([
    ...tokenize(req.description || ""),
    ...(project?.neededCapabilities.flatMap((c) => tokenize(c)) || []),
    ...(req.preferredLabCategories || []).map((c) => c.toLowerCase()),
  ]);

  let score = 40;
  const rationale: string[] = [];
  const fairness: string[] = [];
  const conflicts: string[] = [];

  const hay = `${equipment.name} ${equipment.category} ${equipment.description} ${equipment.tags.join(" ")} ${lab.category}`.toLowerCase();
  let matches = 0;
  Array.from(tokens).forEach((t) => {
    if (hay.includes(t)) matches += 1;
  });
  const matchScore = Math.min(35, matches * 5);
  score += matchScore;
  if (matches) rationale.push(`Matched ${matches} requirement keywords to ${equipment.name}.`);

  if (req.preferredLabCategories?.includes(lab.category)) {
    score += 10;
    rationale.push(`Preferred lab category ${lab.category}.`);
  }

  if (equipment.status === "AVAILABLE") {
    score += 8;
  } else {
    score -= 25;
    conflicts.push(`Equipment status is ${equipment.status}.`);
  }

  // Utilization fairness — prefer less crowded labs
  const utilPenalty = Math.round((lab.utilizationPct - 50) / 5);
  score -= utilPenalty;
  if (lab.utilizationPct > 80) {
    fairness.push(`High utilization (${lab.utilizationPct}%) — consider alternate lab if feasible.`);
  } else {
    fairness.push(`Lab utilization ${lab.utilizationPct}% leaves room for fair access.`);
  }

  // Deadline urgency boost (reads institutional policy weights)
  const weights = priorityWeights(state);
  if (project) {
    const daysLeft = (+new Date(project.deadline) - Date.now()) / (24 * 60 * 60 * 1000);
    const base = weights[project.priority] ?? DEFAULT_PRIORITY_WEIGHT[project.priority];
    const urgency = base * (daysLeft < 7 ? 2 : 1);
    score += urgency * 2;
    rationale.push(`Project priority ${project.priority} with ~${Math.max(0, Math.round(daysLeft))} days to deadline.`);
    if (daysLeft < 5) fairness.push("Deadline pressure applied — scheduling preference granted within policy caps.");
  }

  const maxBorrow = state.policies?.maxBorrowDurationDays;
  if (maxBorrow) {
    fairness.push(`Institutional max borrow duration: ${maxBorrow} days.`);
  }

  // Training readiness (only when allocating for a specific student)
  if (req.studentId) {
    const certified = new Set(
      state.trainingRecords
        .filter((t) => t.userId === req.studentId && t.status === "CERTIFIED")
        .map((t) => t.trainingId)
    );
    const required = [...new Set([...lab.requiredTrainings, ...equipment.requiresTrainingIds])];
    const missing = required.filter((t) => !certified.has(t));
    if (missing.length) {
      score -= 20;
      conflicts.push(`Missing training: ${missing.join(", ")}`);
    } else {
      score += 6;
      rationale.push("Student holds all required safety/training credentials.");
    }
  }

  // Outstanding fines
  if (req.studentId) {
    const student = state.users.find((u) => u.id === req.studentId);
    if (student && student.fineBalance > 0) {
      score -= 30;
      conflicts.push(`Outstanding fine balance ₹${student.fineBalance} blocks booking until cleared.`);
    }

    const activeCount = state.bookings.filter(
      (b) => b.studentId === req.studentId && ["PENDING", "APPROVED", "ACTIVE"].includes(b.status)
    ).length;
    if (activeCount === 0) {
      score += 5;
      fairness.push("No concurrent holds — fair-access boost applied.");
    } else if (activeCount >= 3) {
      score -= 8;
      fairness.push("Multiple concurrent holds — fairness throttle applied.");
    }
  }

  // Staff dropdown: selected component is the primary need signal
  if (req.equipmentId && equipment.id === req.equipmentId) {
    score += 28;
    rationale.push("Selected component from lab inventory dropdown.");
  } else if (req.equipmentId) {
    const selected = state.equipment.find((e) => e.id === req.equipmentId);
    if (selected) {
      const sharedTags = equipment.tags.filter((t) => selected.tags.includes(t)).length;
      if (sharedTags) {
        score += Math.min(12, sharedTags * 4);
        rationale.push(`Related to selected ${selected.name} (${sharedTags} shared tags).`);
      }
    }
  }

  if (equipment.requiresApproval) {
    rationale.push("Faculty/admin approval required before activation.");
  }

  return { score: Math.max(0, Math.min(100, score)), rationale, fairness, conflicts };
}

/**
 * Deterministic GenAI-style allocator with optional Gemini enhancement.
 * Staff desk: scoped to a lab + selected equipment dropdown option.
 */
export async function recommendAllocations(
  state: AppState,
  req: AiAllocationRequest
): Promise<AiAllocationSuggestion[]> {
  if (!req.labId) throw new Error("labId is required");
  if (!req.equipmentId) throw new Error("equipmentId is required (select a lab component)");

  const project = req.projectId ? state.projects.find((p) => p.id === req.projectId) : undefined;
  const duration = req.durationHours || 2;
  const selected = state.equipment.find((e) => e.id === req.equipmentId);
  if (!selected || selected.labId !== req.labId) {
    throw new Error("Selected equipment must belong to the chosen laboratory");
  }

  const description =
    req.description ||
    `Allocate ${selected.name} (${selected.category}) and related lab inventory for supervised use.`;

  const enriched: AiAllocationRequest = { ...req, description };

  const pool = state.equipment.filter((e) => e.labId === req.labId);
  const scored = pool
    .map((equipment) => {
      const lab = state.labs.find((l) => l.id === equipment.labId)!;
      const { score, rationale, fairness, conflicts } = scoreEquipment(state, equipment, lab, enriched, project);
      const slot = nextOpenSlot(lab, equipment, state.bookings, duration);
      return { equipment, lab, score, rationale, fairness, conflicts, slot };
    })
    .filter((row) => row.slot)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  let narrativeBoost: Record<string, string> = {};
  if (process.env.GEMINI_API_KEY) {
    try {
      narrativeBoost = await geminiNarrate(enriched, scored.map((s) => s.equipment.name));
    } catch {
      // Fall back silently — heuristic allocator remains authoritative.
    }
  }

  return scored.map((row) => ({
    equipmentId: row.equipment.id,
    labId: row.lab.id,
    score: row.score,
    rationale:
      (narrativeBoost[row.equipment.name]
        ? narrativeBoost[row.equipment.name] + " "
        : "") + row.rationale.join(" "),
    suggestedStart: row.slot!.start,
    suggestedEnd: row.slot!.end,
    fairnessNotes: row.fairness.join(" "),
    conflicts: row.conflicts,
    alternatives: scored
      .filter((s) => s.equipment.id !== row.equipment.id)
      .slice(0, 2)
      .map((s) => s.equipment.name),
  }));
}

async function geminiNarrate(req: AiAllocationRequest, names: string[]): Promise<Record<string, string>> {
  const key = process.env.GEMINI_API_KEY!;
  const prompt = `You help faculty allocate campus lab equipment fairly within one laboratory.
Selected need: ${req.description}
Candidate equipment in lab: ${names.join(", ")}
Return strict JSON object mapping equipment name -> one short sentence why it fits. No markdown.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );
  if (!res.ok) return {};
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}
