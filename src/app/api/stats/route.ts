export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDashboardStats, getSessionUser, listProjects, listTrainings } from "@/lib/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = await getSessionUser();
  const actor = user?.role === "STUDENT" ? null : user;
  const stats = await getDashboardStats(actor);
  const projects = await listProjects(searchParams.get("studentId") || undefined);
  const trainings = await listTrainings();
  return NextResponse.json({ stats, projects, trainings });
}
