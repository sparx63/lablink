export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionUser, listOverdue, scanOverdue } from "@/lib/store";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role === "STUDENT") {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }
  const bookings = await listOverdue(user);
  return NextResponse.json({ bookings });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role === "STUDENT") {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }
  const result = await scanOverdue();
  return NextResponse.json(result);
}
