export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { clientKey, jsonError, rateLimit, requireLabStaff } from "@/lib/api";
import { runAiAllocation } from "@/lib/store";
import { AiAllocateSchema, parseBody } from "@/lib/validate";

export async function POST(req: Request) {
  try {
    const session = await requireLabStaff();
    if (!rateLimit(clientKey(req, "ai-allocate"), 20)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = parseBody(AiAllocateSchema, await req.json());
    const suggestions = await runAiAllocation(body, session);
    return NextResponse.json({
      engine: process.env.GEMINI_API_KEY ? "gemini+heuristic" : "heuristic",
      suggestions,
    });
  } catch (e) {
    return jsonError(e);
  }
}
