import { redirect } from "next/navigation";
import { siteUrls } from "@edvio/shared/sites";

/** Public entry point. Login, sign-up, and the school console keep their explicit routes. */
export default function Home() { redirect(siteUrls().landing); }
