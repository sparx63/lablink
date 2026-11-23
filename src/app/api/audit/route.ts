export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionUser, listAuditLog } from "@/lib/store";
import type { AuditEventType } from "@/lib/types";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role === "STUDENT") {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }
  const type = new URL(req.url).searchParams.get("type") as AuditEventType | null;
  const events = await listAuditLog(type || undefined);
  return NextResponse.json({ events });
}
