import { redirect } from "next/navigation";

// Standard Reports was removed from Communication; old links land on Circulars & Notices.
export default function Page() { redirect("/communication"); }
