import { NextResponse } from "next/server";
import { AuthError, clientKey, jsonError, rateLimit, requireSession } from "@/lib/api";
import { createBooking, listBookings } from "@/lib/store";
import type { UsageType } from "@/lib/types";
import { CreateBookingSchema, parseBody } from "@/lib/validate";

export async function GET(req: Request) {
  try {
    const user = await requireSession();
    if (!rateLimit(clientKey(req, "bookings-get"), 120)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const { searchParams } = new URL(req.url);
    // Never trust client studentId for students — always scope to session.
    const studentId =
      user.role === "STUDENT" ? user.id : searchParams.get("studentId") || undefined;
    const actor = user.role === "STUDENT" ? null : user;
    const bookings = await listBookings(
      {
        studentId,
        status: searchParams.get("status") || undefined,
        usageType: (searchParams.get("usageType") as UsageType) || undefined,
      },
      actor
    );
    return NextResponse.json({ bookings });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSession();
    if (!rateLimit(clientKey(req, "bookings-post"), 30)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const raw = await req.json();
    const body = parseBody(CreateBookingSchema, raw);
    // Students can only book for themselves; staff may book on behalf of a studentId.
    const studentId = user.role === "STUDENT" ? user.id : body.studentId;
    if (!studentId) throw new AuthError("studentId required", 400);
    if (user.role === "STUDENT" && body.studentId && body.studentId !== user.id) {
      throw new AuthError("Forbidden", 403);
    }
    const result = await createBooking({ ...body, studentId });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
