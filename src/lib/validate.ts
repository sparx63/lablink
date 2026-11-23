import { z } from "zod";

/** Strip control chars and cap length for free-text fields. */
export function sanitizeText(value: string, max = 2000): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

const isoOrLocal = z
  .string()
  .min(1)
  .max(64)
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid datetime" });

export const SessionBodySchema = z.object({
  userId: z.string().min(1).max(64).nullable().optional(),
});

export const CreateBookingSchema = z.object({
  equipmentId: z.string().min(1).max(64),
  studentId: z.string().min(1).max(64).optional(),
  start: isoOrLocal,
  end: isoOrLocal,
  purpose: z.string().min(1).max(500).transform((s) => sanitizeText(s, 500)),
  notes: z
    .string()
    .max(2000)
    .optional()
    .transform((s) => (s == null ? undefined : sanitizeText(s, 2000))),
  usageType: z.enum(["IN_LAB", "BORROW"]).optional(),
  borrowPurpose: z.enum(["COMPETITION", "COLLEGE_PROJECT", "PERSONAL_PROJECT"]).optional(),
  expectedReturnAt: isoOrLocal.optional(),
  competition: z
    .object({
      name: z.string().min(1).max(200).transform((s) => sanitizeText(s, 200)),
      organiser: z.string().min(1).max(200).transform((s) => sanitizeText(s, 200)),
      date: z.string().min(4).max(32),
      website: z.string().max(500).optional(),
      selectionEvidenceNote: z.string().max(1000).optional(),
      projectDescription: z.string().max(2000).optional(),
    })
    .optional(),
  quantityReserved: z.number().int().min(1).max(32).optional(),
});

export const BookingPatchSchema = z.object({
  action: z.enum(["decide", "checkin", "handover", "checkout", "return_inspect", "resolveConflict"]),
  decision: z.enum(["APPROVED", "REJECTED", "NEEDS_INFO"]).optional(),
  note: z.string().max(1000).optional().transform((s) => (s == null ? undefined : sanitizeText(s, 1000))),
  returnCondition: z.enum(["GOOD", "FAIR", "DAMAGED", "LOST"]).optional(),
  conditionNotes: z.string().max(2000).optional(),
  checklist: z
    .array(
      z.object({
        accessoryId: z.string().max(64).optional(),
        id: z.string().max(64).optional(),
        label: z.string().max(200).optional(),
        present: z.boolean().optional(),
        required: z.boolean().optional(),
      })
    )
    .max(40)
    .optional(),
  photoUrls: z.array(z.string().max(500)).max(10).optional(),
  resolution: z.enum(["KEEP", "SHIFT", "CANCEL"]).optional(),
});

export const FinePostSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("incident"),
    bookingId: z.string().min(1).max(64),
    type: z.enum(["LOST", "BROKEN", "DAMAGED", "MISSING_PARTS", "CONTAMINATED"]),
    description: z.string().min(1).max(2000).transform((s) => sanitizeText(s, 2000)),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    fineAmount: z.number().min(0).max(1_000_000).optional(),
    fineReason: z.string().max(500).optional(),
  }),
  z.object({
    kind: z.literal("update"),
    fineId: z.string().min(1).max(64),
    patch: z
      .object({
        status: z.enum(["PENDING", "PARTIAL", "PAID", "WAIVED"]).optional(),
        amount: z.number().min(0).max(1_000_000).optional(),
        paidAmount: z.number().min(0).max(1_000_000).optional(),
        reason: z.string().max(500).optional(),
      })
      .default({}),
  }),
]);

export const TimetableUpsertSchema = z.object({
  action: z.literal("delete").optional(),
  id: z.string().max(64).optional(),
  event: z
    .object({
      id: z.string().max(64).optional(),
      labId: z.string().min(1).max(64),
      title: z.string().min(1).max(200).transform((s) => sanitizeText(s, 200)),
      subject: z.string().min(1).max(200).transform((s) => sanitizeText(s, 200)),
      cohort: z.string().min(1).max(200).transform((s) => sanitizeText(s, 200)),
      dayOfWeek: z.number().int().min(0).max(6).optional(),
      eventDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      startHour: z.number().min(0).max(24),
      endHour: z.number().min(0).max(24),
      eventType: z.enum(["CLASS", "SPECIAL", "EXAM", "MAINTENANCE", "HOLIDAY"]),
      notes: z.string().max(1000).optional(),
      facultyId: z.string().max(64).optional(),
      published: z.boolean().optional(),
      classKey: z.string().max(300).optional(),
    })
    .optional(),
});

export const AiAllocateSchema = z.object({
  labId: z.string().min(1).max(64),
  equipmentId: z.string().min(1).max(64),
  studentId: z.string().max(64).optional(),
  projectId: z.string().max(64).optional(),
  durationHours: z.number().min(0.5).max(72).optional(),
  preferredStart: z.string().max(64).optional(),
  notes: z.string().max(1000).optional(),
});

export const ExamActionSchema = z.object({
  action: z.enum(["create-exam", "start", "end", "publish", "allocate", "mark", "upsert-experiment"]),
  examId: z.string().max(64).optional(),
  exam: z.record(z.string(), z.unknown()).optional(),
  allocation: z.record(z.string(), z.unknown()).optional(),
  mark: z.record(z.string(), z.unknown()).optional(),
  experiment: z.record(z.string(), z.unknown()).optional(),
});

export const ExamGenerateSchema = z.object({
  examId: z.string().max(64).optional(),
  labId: z.string().max(64).optional(),
  experimentIds: z.array(z.string().min(1).max(64)).min(1).max(40),
  mode: z.enum(["INDIVIDUAL", "GROUP"]),
  groupSize: z.number().int().min(2).max(12).optional(),
  studentIds: z.array(z.string().max(64)).max(200).optional(),
  save: z.boolean().optional(),
});

export const NotificationPatchSchema = z.object({
  id: z.string().min(1).max(64),
});

export const SavedToggleSchema = z.object({
  equipmentId: z.string().max(64).optional(),
  labId: z.string().max(64).optional(),
});

export const PoliciesPatchSchema = z.object({
  patch: z.record(z.string(), z.unknown()),
});

export const ImportBodySchema = z.object({
  csvText: z.string().min(1).max(500_000),
  preview: z.boolean().optional(),
});

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function parseBody<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.length ? `${first.path.join(".")}: ` : "";
    throw new ValidationError(`${path}${first?.message || "Invalid request"}`);
  }
  return result.data;
}
