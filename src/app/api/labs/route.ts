export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getSessionUser, listLabs } from "@/lib/store";

export async function GET() {
  const user = await getSessionUser();
  // Students and anonymous discovery get campus-wide labs; staff are scoped.
  const actor = user?.role === "STUDENT" ? null : user;
  return NextResponse.json({ labs: await listLabs(actor) });
}
