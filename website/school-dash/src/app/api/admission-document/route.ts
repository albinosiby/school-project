const maxBytes = 10 * 1024 * 1024;
const admissionPath = /^schools\/[\w-]{1,128}\/admission-documents\/[\w-]{1,128}\/(photo|birth|transfer|marksheet|parentId|caste|disability|medical)\/[a-f0-9-]{36}$/;
const allowedTypes = new Set(["image/png", "image/jpeg", "application/pdf"]);

function fail(status: number, message: string) {
  return Response.json({ message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Firebase ")) return fail(401, "Sign in to view this file.");

  const payload = await request.json().catch(() => null) as { path?: unknown } | null;
  const path = payload?.path;
  if (typeof path !== "string" || !admissionPath.test(path)) return fail(400, "Invalid admission file.");

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) return fail(503, "Document storage is not configured.");
  const useEmulator = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_EMULATOR === "true";
  const origin = useEmulator
    ? `http://${process.env.NEXT_PUBLIC_EMULATOR_HOST || "localhost"}:9199`
    : "https://firebasestorage.googleapis.com";
  const url = `${origin}/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`;

  try {
    // Forward the signed-in user's token so Firebase still enforces the bucket rules.
    const response = await fetch(url, {
      headers: { Authorization: authorization, Range: `bytes=0-${maxBytes - 1}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
    });
    if (response.status === 401 || response.status === 403) return fail(403, "You do not have access to this file.");
    if (response.status === 404) return fail(404, "This upload could not be found.");
    if (!response.ok || !response.body) return fail(502, "Storage could not load the file.");
    const mime = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!allowedTypes.has(mime)) return fail(415, "This file format is not supported.");
    const size = Number(response.headers.get("content-range")?.split("/").at(-1) ?? response.headers.get("content-length"));
    if (!Number.isFinite(size) || size <= 0 || size >= maxBytes) return fail(413, "The file must be smaller than 10 MB.");
    return new Response(response.body, { headers: {
      "Content-Type": mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return fail(502, "Storage could not load the file. Try again.");
  }
}
