export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { jsonError, requireLabStaff } from "@/lib/api";
import { listOverdue, scanOverdue } from "@/lib/store";

export async function GET() {
  try {
    const user = await requireLabStaff();
    const bookings = await listOverdue(user);
    return NextResponse.json({ bookings });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST() {
  try {
    await requireLabStaff();
    const result = await scanOverdue();
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
