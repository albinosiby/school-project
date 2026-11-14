import { expect, it } from "vitest";
import { AdmissionSeatSettings } from "./AdmissionSeatSettings";
import { dialog, field, getRow, renderUI, screen, seed, within } from "@/test/render";

it("directs configured regular grades to section settings so admissions capacity cannot drift", async () => {
  seed({ set_sections: [{ id: "sec_grade9", grade: "Grade 9", sections: ["9-A", "9-B"], cap: 70 }],
    adm_seats: [{ id: "legacy_seat", grade: "9", group: "middle", capacity: 80, rteSeats: 0 }] });
  const { user } = renderUI(<AdmissionSeatSettings />);
  await user.click(screen.getByRole("button", { name: "Edit admissions seats" }));
  const dlg = dialog("Edit admissions seats");
  await user.selectOptions(field("Grade or stream", dlg), "9");
  expect(field("Capacity", dlg)).toBeDisabled();
  expect(field("Capacity", dlg)).toHaveValue(70);
  expect(within(dlg).getByRole("link", { name: "Open grade settings" })).toHaveAttribute("href", "/settings/grades/sec_grade9");
  expect(within(dlg).queryByRole("button", { name: "Save capacity" })).not.toBeInTheDocument();
});

it("still allows admissions capacity setup for a grade without configured sections", async () => {
  const { user } = renderUI(<AdmissionSeatSettings />);
  await user.click(screen.getByRole("button", { name: "Edit admissions seats" }));
  const dlg = dialog("Edit admissions seats");
  await user.selectOptions(field("Grade or stream", dlg), "LKG");
  await user.type(field("Capacity", dlg), "25");
  await user.click(within(dlg).getByRole("button", { name: "Save capacity" }));
  expect(getRow("adm_seats", "adm_seat_lkg")).toMatchObject({ grade: "LKG", group: "pre", capacity: 25 });
});
