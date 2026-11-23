import { NextResponse } from "next/server";
import { AuthError, clientKey, jsonError, rateLimit, requireLabStaff, requireSession } from "@/lib/api";
import { checkInOut, decideBooking, resolveConflict } from "@/lib/store";
import type { ChecklistLine } from "@/lib/types";
import { BookingPatchSchema, parseBody } from "@/lib/validate";

function toChecklist(
  rows?: Array<{ accessoryId?: string; id?: string; label?: string; present?: boolean }>
): ChecklistLine[] | undefined {
  if (!rows?.length) return undefined;
  return rows.map((r) => ({
    accessoryId: r.accessoryId || r.id || "",
    label: r.label || "",
    present: !!r.present,
  }));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    if (!rateLimit(clientKey(req, "bookings-patch"), 60)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = parseBody(BookingPatchSchema, await req.json());
    const { action } = body;
    const checklist = toChecklist(body.checklist);

    // Custody / approval mutations always use server session identity — never trust client actorId.
    if (action === "decide") {
      await requireLabStaff();
      if (!body.decision) throw new AuthError("decision required", 400);
      const booking = await decideBooking(params.id, body.decision, session.id, body.note);
      return NextResponse.json({ booking });
    }
    if (action === "checkin") {
      await requireLabStaff();
      const booking = await checkInOut(params.id, "IN", undefined, session.id);
      return NextResponse.json({ booking });
    }
    if (action === "handover") {
      await requireLabStaff();
      const booking = await checkInOut(params.id, "HANDOVER", undefined, session.id, {
        checklist,
        photoUrls: body.photoUrls,
        conditionNotes: body.conditionNotes,
      });
      return NextResponse.json({ booking });
    }
    if (action === "checkout") {
      await requireLabStaff();
      const booking = await checkInOut(params.id, "OUT", body.returnCondition, session.id, {
        checklist,
        photoUrls: body.photoUrls,
        conditionNotes: body.conditionNotes,
      });
      return NextResponse.json({ booking });
    }
    if (action === "return_inspect") {
      await requireLabStaff();
      const booking = await checkInOut(
        params.id,
        "RETURN_INSPECT",
        body.returnCondition || "GOOD",
        session.id,
        {
          checklist,
          photoUrls: body.photoUrls,
          conditionNotes: body.conditionNotes,
        }
      );
      return NextResponse.json({ booking });
    }
    if (action === "resolveConflict") {
      await requireLabStaff();
      if (!body.resolution) throw new AuthError("resolution required", 400);
      const result = await resolveConflict(params.id, body.resolution, session.id);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return jsonError(e);
  }
}
