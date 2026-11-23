export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { AuthError, clientKey, jsonError, rateLimit, requireLabStaff, requireSession } from "@/lib/api";
import { listFines, reportIncident, updateFine } from "@/lib/store";
import { FinePostSchema, parseBody } from "@/lib/validate";

export async function GET(req: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(req.url);
    // Students only see their own fines; staff are lab-scoped via listFines actor.
    const studentId =
      user.role === "STUDENT" ? user.id : searchParams.get("studentId") || undefined;
    const actor = user.role === "STUDENT" ? null : user;
    const fines = await listFines(studentId, actor);
    return NextResponse.json({ fines });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!rateLimit(clientKey(req, "fines-post"), 20)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = parseBody(FinePostSchema, await req.json());
    if (body.kind === "incident") {
      await requireLabStaff();
      const result = await reportIncident({
        bookingId: body.bookingId,
        reportedById: session.id,
        type: body.type,
        description: body.description,
        severity: body.severity,
        fineAmount: body.fineAmount,
        fineReason: body.fineReason,
      });
      return NextResponse.json(result, { status: 201 });
    }
    if (body.kind === "update") {
      // Students may mark their own fine paid; staff may update within lab scope.
      if (session.role === "STUDENT") {
        const mine = await listFines(session.id, null);
        if (!mine.some((f) => f.id === body.fineId)) throw new AuthError("Forbidden", 403);
      } else {
        await requireLabStaff();
      }
      const fine = await updateFine(body.fineId, body.patch || {}, session);
      return NextResponse.json({ fine });
    }
    return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  } catch (e) {
    return jsonError(e);
  }
}
