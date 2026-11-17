import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field, Input, LoadingField, LoadingSkeleton } from "@/components/ui";

describe("shared loading feedback", () => {
  it("announces loading without exposing decorative content as controls", () => {
    const { rerender } = render(<LoadingSkeleton variant="page" label="Loading school data…" />);
    expect(screen.getByRole("status", { name: "Loading school data…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    rerender(<p>Contact: <LoadingSkeleton variant="inline" label="Loading phone…" /></p>);
    expect(screen.getByRole("status", { name: "Loading phone…" }).tagName).toBe("SPAN");
  });

  it("preserves labelled form values when loading finishes", () => {
    const form = (loading: boolean) => <Field label="Employee ID"><LoadingField loading={loading} label="Loading employee ID…"><Input readOnly value="EMP-42" /></LoadingField></Field>;
    const { rerender } = render(form(true));
    const input = screen.getByRole("textbox", { name: "Employee ID" });
    expect(input).toHaveValue("EMP-42");
    expect(input.parentElement).toHaveAttribute("aria-busy", "true");
    rerender(form(false));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(input.parentElement).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("textbox", { name: "Employee ID" })).toBe(input);
    expect(input).toHaveValue("EMP-42");
  });
});
