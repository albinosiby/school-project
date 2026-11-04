import { describe, expect, it } from "vitest";
import { ProfileView } from "./ProfileView";
import { field, fieldError, getRow, renderUI, screen, seed, writes, writesTo } from "@/test/render";

const me = { id: "me", name: "Dr. Kavita Rao", title: "Principal", role: "Super Admin", email: "kavita@school.test", phone: "+91 98100 00001" };
function setup() {
  seed({ me: [me] });
  return renderUI(<ProfileView />);
}

describe("Profile form validation", () => {
  it("first name, email and phone are required; nothing is written", async () => {
    const { user } = setup();
    await user.clear(field("First Name"));
    await user.clear(field("Official Institutional Email"));
    await user.clear(field("Official Contact Line"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(fieldError("First Name")).toBe("First name is required");
    expect(fieldError("Official Institutional Email")).toBe("Enter a valid email address");
    expect(fieldError("Official Contact Line")).toBe("Enter a valid phone number");
    expect(screen.getByText("Please fix the highlighted fields")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("rejects malformed email / phone and a recovery email equal to the official one", async () => {
    const { user } = setup();
    await user.type(field("Alternate / Recovery Email"), "KAVITA@school.test");
    await user.clear(field("Official Contact Line"));
    await user.type(field("Official Contact Line"), "98100 0000 12345 678");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(fieldError("Alternate / Recovery Email")).toBe("Use a different address from the official email");
    expect(fieldError("Official Contact Line")).toBe("Enter a valid phone number");
    await user.clear(field("Official Institutional Email"));
    await user.type(field("Official Institutional Email"), "kavita@school");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(fieldError("Official Institutional Email")).toBe("Enter a valid email address");
    await user.clear(field("Official Contact Line"));
    await user.type(field("Official Contact Line"), "98100abc12");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(fieldError("Official Contact Line")).toBe("Enter a valid phone number");
    expect(writes).toHaveLength(0);
  });

  it("saves the trimmed values and keeps the honorific", async () => {
    const { user } = setup();
    await user.clear(field("First Name"));
    await user.type(field("First Name"), " Kavita ");
    await user.clear(field("Last Name"));
    await user.type(field("Last Name"), "Rao-Menon");
    await user.type(field("Alternate / Recovery Email"), " k.rao@gmail.com ");
    await user.clear(field("Official Contact Line"));
    await user.type(field("Official Contact Line"), "+91 (98100) 00099");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    expect(writesTo("me")).toHaveLength(1);
    expect(getRow("me", "me")).toMatchObject({ name: "Dr. Kavita Rao-Menon", email: "kavita@school.test", altEmail: "k.rao@gmail.com", phone: "+91 (98100) 00099" });
  });

  it("a preference toggle creates me_prefs/me when the school never had one", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("switch", { name: "Weekly Executive Digest" }));
    expect(await screen.findByText("Preference saved")).toBeInTheDocument();
    expect(writesTo("me_prefs")[0]).toMatchObject({ op: "set", id: "me" });
    expect(getRow("me_prefs", "me")).toMatchObject({ weeklyDigest: true, emergencySub: true });
  });
});
