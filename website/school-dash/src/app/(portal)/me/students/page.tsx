import { redirect } from "next/navigation";

/** the former "My classes" address: the page now lives at /me/classes */
export default function Page() { redirect("/me/classes"); }
