export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { AuthError, jsonError, requireSession, requireStaff } from "@/lib/api";
import {
  deleteTimetableEvent,
  getStudentLabTimetable,
  listLabClassOptions,
  listTimetable,
  upsertTimetableEvent,
} from "@/lib/store";
import { parseBody, TimetableUpsertSchema } from "@/lib/validate";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studentIdParam = searchParams.get("studentId");
    const labId = searchParams.get("labId") || undefined;
    const wantClasses = searchParams.get("classes") === "1";
    const user = await requireSession();

    // My Lab Timetable — enrolment / class membership only.
    if (studentIdParam) {
      if (user.role === "STUDENT" && user.id !== studentIdParam) {
        throw new AuthError("Forbidden", 403);
      }
      const data = await getStudentLabTimetable(studentIdParam);
      return NextResponse.json(data);
    }

    if (wantClasses) {
      if (!labId) {
        return NextResponse.json({ error: "labId is required for class options" }, { status: 400 });
      }
      if (user.role === "STUDENT") throw new AuthError("Staff only", 403);
      const classes = await listLabClassOptions(labId);
      return NextResponse.json({ classes });
    }

    // Lab schedule for booking/explore: any signed-in user with labId.
    // Staff without labId: scoped to managed labs (or campus-wide for coordinator / SUPER_ADMIN).
    if (user.role === "STUDENT") {
      if (!labId) {
        return NextResponse.json(
          {
            error:
              "Students: use studentId for My Lab Timetable, or labId to view a lab schedule while booking.",
          },
          { status: 400 }
        );
      }
      const events = await listTimetable(labId, null, { forBooking: true, publishedOnly: true });
      return NextResponse.json({ events, visibility: "lab-booking" });
    }

    if (user.role === "TIMETABLE_COORDINATOR" || user.role === "SUPER_ADMIN") {
      const events = await listTimetable(labId, null, { publishedOnly: false });
      return NextResponse.json({ events, visibility: "campus" });
    }

    const events = await listTimetable(labId, user, { publishedOnly: false });
    return NextResponse.json({ events, visibility: "teacher" });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireStaff({ allowCoordinator: true });
    const body = parseBody(TimetableUpsertSchema, await req.json());
    if (body.action === "delete") {
      if (!body.id) throw new AuthError("id required", 400);
      const removed = await deleteTimetableEvent(body.id, user);
      return NextResponse.json({ removed });
    }
    if (!body.event) throw new AuthError("event required", 400);
    const ev = body.event;
    if (ev.dayOfWeek == null && !ev.eventDate) {
      throw new AuthError("dayOfWeek or eventDate required", 400);
    }
    const event = await upsertTimetableEvent(
      {
        ...ev,
        dayOfWeek: ev.dayOfWeek ?? 0,
      },
      user
    );
    return NextResponse.json({ event }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
