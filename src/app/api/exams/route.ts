export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { AuthError, clientKey, jsonError, rateLimit, requireLabStaff, requireSession } from "@/lib/api";
import {
  allocateExperiment,
  createPracticalExam,
  endPracticalExam,
  getStudentExaminations,
  getStudentResults,
  listExperimentBank,
  listLabExamRoster,
  listPracticalExams,
  publishExamResults,
  startPracticalExam,
  upsertExperimentBankItem,
  upsertMark,
} from "@/lib/store";
import type { ExamAllocation, ExperimentBankItem, MarkRecord, PracticalExam } from "@/lib/types";
import { ExamActionSchema, parseBody } from "@/lib/validate";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const user = await requireSession();
    const view = searchParams.get("view");
    const labId = searchParams.get("labId") || undefined;

    if (view === "roster") {
      if (!labId) return NextResponse.json({ error: "labId required" }, { status: 400 });
      await requireLabStaff();
      const roster = await listLabExamRoster(labId, user);
      return NextResponse.json({ roster });
    }

    if (view === "student-exams") {
      const studentId = user.role === "STUDENT" ? user.id : searchParams.get("studentId") || user.id;
      if (user.role === "STUDENT" && searchParams.get("studentId") && searchParams.get("studentId") !== user.id) {
        throw new AuthError("Forbidden", 403);
      }
      const exams = await getStudentExaminations(studentId);
      return NextResponse.json({ exams });
    }
    if (view === "student-results") {
      const studentId = user.role === "STUDENT" ? user.id : searchParams.get("studentId") || user.id;
      if (user.role === "STUDENT" && searchParams.get("studentId") && searchParams.get("studentId") !== user.id) {
        throw new AuthError("Forbidden", 403);
      }
      const results = await getStudentResults(studentId);
      return NextResponse.json({ results });
    }
    if (view === "bank") {
      const bank = await listExperimentBank(labId, user.role === "STUDENT" ? null : user);
      return NextResponse.json({ bank });
    }

    const exams = await listPracticalExams(labId, user.role === "STUDENT" ? null : user);
    const bank = await listExperimentBank(labId, user.role === "STUDENT" ? null : user);
    return NextResponse.json({ exams, bank });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireLabStaff();
    if (!rateLimit(clientKey(req, "exams-post"), 40)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = parseBody(ExamActionSchema, await req.json());
    const { action } = body;

    if (action === "create-exam") {
      const exam = await createPracticalExam(body.exam as Omit<PracticalExam, "id" | "createdAt" | "status">, user);
      return NextResponse.json({ exam }, { status: 201 });
    }
    if (action === "start") {
      if (!body.examId) throw new AuthError("examId required", 400);
      const exam = await startPracticalExam(body.examId, user);
      return NextResponse.json({ exam });
    }
    if (action === "end") {
      if (!body.examId) throw new AuthError("examId required", 400);
      const exam = await endPracticalExam(body.examId, user);
      return NextResponse.json({ exam });
    }
    if (action === "publish") {
      if (!body.examId) throw new AuthError("examId required", 400);
      const exam = await publishExamResults(body.examId, user);
      return NextResponse.json({ exam });
    }
    if (action === "allocate") {
      const allocation = await allocateExperiment(body.allocation as Omit<ExamAllocation, "id">, user);
      return NextResponse.json({ allocation });
    }
    if (action === "mark") {
      const mark = await upsertMark(body.mark as Omit<MarkRecord, "id" | "updatedAt" | "published">, user);
      return NextResponse.json({ mark });
    }
    if (action === "upsert-experiment") {
      const item = await upsertExperimentBankItem(
        body.experiment as Omit<ExperimentBankItem, "id"> & { id?: string },
        user
      );
      return NextResponse.json({ item });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return jsonError(e);
  }
}
