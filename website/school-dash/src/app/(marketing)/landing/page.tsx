import { redirect } from "next/navigation";
import { siteUrls } from "@edvio/shared/sites";

export default function LandingRedirect() { redirect(siteUrls().landing); }
