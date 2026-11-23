export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { clientKey, jsonError, rateLimit, requireLabStaff } from "@/lib/api";
import { generateExamAllocations } from "@/lib/store";
import { ExamGenerateSchema, parseBody } from "@/lib/validate";

export async function POST(req: Request) {
  try {
    const user = await requireLabStaff();
    if (!rateLimit(clientKey(req, "exam-generate"), 20)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = parseBody(ExamGenerateSchema, await req.json());
    const result = await generateExamAllocations(body, user);
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
