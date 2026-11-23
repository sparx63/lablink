export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDashboardStats, getSessionUser } from "@/lib/store";

/** Lean dashboard stats — omit unused projects/trainings payloads. */
export async function GET() {
  const user = await getSessionUser();
  const actor = user?.role === "STUDENT" ? null : user;
  const stats = await getDashboardStats(actor);
  return NextResponse.json({ stats });
}
