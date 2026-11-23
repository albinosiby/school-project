import { expect, it } from "vitest";
import { certificateError } from "./service";

it("shows a useful unavailable message for a callable service outage", () => {
  expect(certificateError({ code: "functions/unavailable", message: "UNAVAILABLE" })).toBe("The certificate service is unavailable. Please try again later.");
});

it("preserves actionable server validation errors", () => {
  expect(certificateError({ code: "functions/failed-precondition", message: "Firebase: The template changed. (functions/failed-precondition)." })).toBe("The template changed.");
});

it("always supplies visible text for missing or malformed error responses", () => {
  for (const value of [undefined, null, {}, { message: "" }, { message: 503 }]) {
    expect(certificateError(value)).toBe("Could not complete this certificate action. Please try again.");
  }
});
