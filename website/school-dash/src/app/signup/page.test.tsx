import { expect, it } from "vitest";
import { redirect } from "next/navigation";
import SignUpPage from "./page";

it("routes legacy school signup links to sign in", () => {
  SignUpPage();
  expect(redirect).toHaveBeenCalledWith("/login");
});
