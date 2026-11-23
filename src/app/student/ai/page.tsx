import { redirect } from "next/navigation";

/** Students never use AI Allocate — hard redirect to student home. */
export default function StudentAiRedirectPage() {
  redirect("/student");
}
