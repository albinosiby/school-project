import { expect, it } from "vitest";
import { PaymentSettings } from "./PaymentSettings";
import { field, getRow, renderUI, screen, seed, writesTo } from "@/test/render";

it("changes transport frequency without changing amounts or other payment preferences and restores it", async () => {
  seed({ set_config: [{ id: "fee_policy", transportFrequency: "Monthly", upi: true, card: false }],
    student_transport_fees: [{ id: "student", amount: 700 }], fee_invoices: [{ id: "issued", amount: 700 }] });
  const { user, unmount } = renderUI(<PaymentSettings />);
  await user.selectOptions(field("Transport collection frequency"), "Term-wise");
  await user.click(screen.getByRole("button", { name: "Save payment settings" }));
  expect(getRow("set_config", "fee_policy")).toMatchObject({ transportFrequency: "Term-wise", upi: true, card: false });
  expect(writesTo("student_transport_fees")).toHaveLength(0);
  expect(writesTo("fee_invoices")).toHaveLength(0);
  unmount(); renderUI(<PaymentSettings />);
  expect(field("Transport collection frequency")).toHaveValue("Term-wise");
});

it("creates payment settings when none exist and rejects a concurrent frequency change", async () => {
  const { user, unmount } = renderUI(<PaymentSettings />);
  await user.selectOptions(field("Transport collection frequency"), "Annual");
  await user.click(screen.getByRole("button", { name: "Save payment settings" }));
  expect(getRow("set_config", "fee_policy")).toMatchObject({ transportFrequency: "Annual" });
  unmount();
  const next = renderUI(<PaymentSettings />);
  await next.user.selectOptions(field("Transport collection frequency"), "Monthly");
  seed({ set_config: [{ id: "fee_policy", transportFrequency: "Term-wise" }] });
  await next.user.click(screen.getByRole("button", { name: "Save payment settings" }));
  expect(screen.getByRole("alert")).toHaveTextContent("another window");
  expect(getRow("set_config", "fee_policy")).toMatchObject({ transportFrequency: "Term-wise" });
});
