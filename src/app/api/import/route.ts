export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { AuthError, clientKey, jsonError, rateLimit, requireSession } from "@/lib/api";
import {
  getSampleCsv,
  importStudentCsv,
  listProgrammes,
  listUsers,
  previewStudentCsv,
  progressStudent,
} from "@/lib/store";
import { z } from "zod";
import { parseBody, sanitizeText } from "@/lib/validate";

const ImportActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("preview"),
    csv: z.string().min(1).max(500_000),
  }),
  z.object({
    action: z.literal("import"),
    csv: z.string().min(1).max(500_000),
  }),
  z.object({
    action: z.literal("progress"),
    studentId: z.string().min(1).max(64),
    progressAction: z.enum(["PROMOTE", "BACKLOG", "CORRECT"]),
    patch: z
      .object({
        semester: z.number().int().min(1).max(12).optional(),
        year: z.number().int().min(1).max(6).optional(),
        academicStanding: z
          .enum(["ACTIVE", "BACKLOG", "DEFERRED", "TRANSFERRED", "DISCONTINUED"])
          .optional(),
        backlogSemesters: z.array(z.number().int()).max(12).optional(),
      })
      .optional(),
  }),
]);

export async function GET() {
  try {
    const user = await requireSession();
    if (user.role !== "SUPER_ADMIN") throw new AuthError("Central admin only", 403);
    const [sampleCsv, programmes, users] = await Promise.all([
      getSampleCsv(),
      listProgrammes(),
      listUsers(),
    ]);
    return NextResponse.json({
      sampleCsv,
      programmes,
      students: users.filter((u) => u.role === "STUDENT"),
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSession();
    if (user.role !== "SUPER_ADMIN") throw new AuthError("Central admin only", 403);
    if (!rateLimit(clientKey(req, "import"), 10)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = parseBody(ImportActionSchema, await req.json());
    if (body.action === "preview") {
      const preview = await previewStudentCsv(sanitizeText(body.csv, 500_000));
      return NextResponse.json(preview);
    }
    if (body.action === "import") {
      const result = await importStudentCsv(sanitizeText(body.csv, 500_000), user);
      return NextResponse.json(result);
    }
    if (body.action === "progress") {
      const student = await progressStudent(body.studentId, body.progressAction, user, body.patch);
      return NextResponse.json({ student });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return jsonError(e);
  }
}
