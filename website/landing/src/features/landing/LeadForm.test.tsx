import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { failNextWrite } from "@/test/fakeDb";
import { LeadForm } from "./LeadForm";

const fill = async (u: ReturnType<typeof userEvent.setup>) => {
  await u.type(screen.getByLabelText(/your name/i), "Priya Nair");
  await u.type(screen.getByLabelText(/^school/i), "Sunrise Public School");
  await u.type(screen.getByLabelText(/work email/i), "priya@sunrise.edu");
};

describe("LeadForm", () => {
  it("shows field errors and writes nothing on an empty submit", async () => {
    const u = userEvent.setup();
    render(<LeadForm />);
    await u.click(screen.getByRole("button", { name: /book a demo/i }));
    expect(screen.getByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your school's name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect((await getDocs(collection(db, "leads"))).size).toBe(0);
  });

  it("writes the lead and thanks the visitor", async () => {
    const u = userEvent.setup();
    render(<LeadForm />);
    await fill(u);
    await u.click(screen.getByRole("button", { name: /book a demo/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Thanks, Priya. We have your request.");
    const rows = (await getDocs(collection(db, "leads"))).docs.map((d) => d.data() as Record<string, unknown>);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Priya Nair", school: "Sunrise Public School", email: "priya@sunrise.edu", source: "landing", status: "new" });
  });

  it("offers the mailto fallback when the write fails", async () => {
    const u = userEvent.setup();
    render(<LeadForm />);
    await fill(u);
    failNextWrite();
    await u.click(screen.getByRole("button", { name: /book a demo/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We could not send the request just now.");
    const link = alert.querySelector("a")!;
    expect(link.getAttribute("href")).toMatch(/^mailto:info@tatos\.tech\?subject=Demo%20request%20%C2%B7%20Sunrise%20Public%20School/);
    expect(decodeURIComponent(link.getAttribute("href")!)).toContain("Name: Priya Nair");
  });
});
