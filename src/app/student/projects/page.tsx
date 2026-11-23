import { redirect } from "next/navigation";

/** Projects UX removed from student workspace — hard redirect. */
export default function StudentProjectsRedirectPage() {
  redirect("/student");
}
