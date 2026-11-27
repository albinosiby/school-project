import { redirect } from "next/navigation";

// the old homework page is now Assignments
export default function Page() {
  redirect("/me/assignments");
}
