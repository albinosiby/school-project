import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const path = "schools/sch_test/admission-documents/stu_001/photo/00000000-0000-0000-0000-000000000001";
function request(file = path, authorization?: string) {
  return new Request("http://localhost/api/admission-document", {
    method: "POST",
    headers: authorization ? { Authorization: authorization } : {},
    body: JSON.stringify({ path: file }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Admission document reader", () => {
  it("rejects unsigned and unrelated requests before contacting storage", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("schools/sch_test/branding/logo", "Firebase test-token"))).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("uses the caller's identity and returns a private response only when Storage allows it", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "demo.firebasestorage.app");
    vi.stubEnv("NEXT_PUBLIC_EMULATOR", "false");
    const upstream = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response("img", { headers: { "content-type": "image/png", "content-length": "3" } }));
    vi.stubGlobal("fetch", upstream);
    expect((await POST(request(path, "Firebase denied"))).status).toBe(403);
    const photo = await POST(request(path, "Firebase allowed"));
    expect(photo.status).toBe(200);
    expect(photo.headers.get("cache-control")).toBe("private, no-store");
    expect(photo.headers.get("content-type")).toBe("image/png");
    expect(await photo.text()).toBe("img");
    expect(upstream).toHaveBeenLastCalledWith(
      `https://firebasestorage.googleapis.com/v0/b/demo.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Firebase allowed" }) }),
    );
  });
});
