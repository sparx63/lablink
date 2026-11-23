export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getSessionUser, listEquipment } from "@/lib/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = await getSessionUser();
  // Students explore all labs campus-wide; lab teachers are scoped server-side.
  const actor = user?.role === "STUDENT" ? null : user;
  const items = await listEquipment(
    {
      q: searchParams.get("q") || undefined,
      labId: searchParams.get("labId") || undefined,
      category: searchParams.get("category") || undefined,
      availableOnly: searchParams.get("availableOnly") === "1",
      borrowableOnly: searchParams.get("borrowableOnly") === "1",
    },
    actor
  );
  return NextResponse.json({ equipment: items });
}
