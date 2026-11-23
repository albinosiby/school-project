import { expect, it } from "vitest";
import CertificatesPage from "@/app/(app)/certificates/page";
import StudentsPage from "@/app/(app)/students/page";
import { NavLinks } from "@/components/shell/Sidebar";
import { dialog, field, renderUI, router, screen, seed, setUrl, within, writes } from "@/test/render";

it("opens certificates from primary navigation and offers only current student records", async () => {
  seed({ students: [
    { id: "active", name: "Current student", grn: "GRN-1", grade: "5", section: "A" },
    { id: "removed", name: "Removed student", grn: "GRN-2", grade: "5", section: "A", deleted: true },
  ], certificates: [
    { id: "request", studentId: "active", studentName: "Current student", classId: "cls_5A", title: "Bonafide Certificate", type: "bonafide", status: "Requested" },
  ] });
  setUrl("/certificates");
  const { user } = renderUI(<><NavLinks /><CertificatesPage /></>);
  expect(screen.getByRole("link", { name: "Certificates" })).toHaveAttribute("href", "/certificates");
  expect(screen.getByRole("link", { name: "Certificates" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("heading", { name: "Certificates" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: /Requests/ })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Issue certificate" }));
  const form = dialog("Issue certificate");
  await user.click(field("Student", form));
  expect(within(form).getByRole("option", { name: /Current student/ })).toBeInTheDocument();
  expect(within(form).queryByRole("option", { name: /Removed student/ })).not.toBeInTheDocument();
  await user.click(within(form).getByRole("button", { name: "Cancel" }));
  expect(writes).toHaveLength(0);
});

it("redirects old certificate tab links to the separate page", () => {
  setUrl("/students?tab=certificates");
  renderUI(<StudentsPage />);
  expect(router.replace).toHaveBeenCalledWith("/certificates");
  expect(screen.getByRole("status")).toHaveTextContent("Opening certificates…");
});

it("removes certificates from the student tabs", () => {
  setUrl("/students");
  renderUI(<StudentsPage />);
  expect(screen.getByRole("tab", { name: /Guardians/ })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /Certificates/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Issue certificate" })).not.toBeInTheDocument();
});
