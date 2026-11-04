import { describe, expect, it } from "vitest";
import { addressErrors, addressRecord, type SchoolAddress } from "./address";
import { INDIA_STATES, NOT_APPLICABLE, OTHER_LOCATION } from "./locations";

const valid: SchoolAddress = { addressLine1: "12 School Road", addressLine2: "", country: "IN", state: "IN.16", district: "IN.16.521", city: "Pune", pin: "411001" };

describe("school address validation", () => {
  it("requires the address and location fields, with an optional second line", () => {
    expect(addressErrors(valid)).toEqual({});
    expect(addressErrors({ ...valid, addressLine1: " ", country: "", state: "", district: "", city: "", pin: "" })).toMatchObject({ addressLine1: "Address line 1 is required.", country: "Choose a country.", state: "Choose a state.", district: "Choose a district.", city: "City is required." });
  });
  it.each(["12345", "1234567", "000001", "41100x", "41 001"])("rejects invalid Indian PIN %s", (pin) => {
    expect(addressErrors({ ...valid, pin }).pin).toBe("Enter a valid 6-digit PIN code.");
  });
  it("accepts a trimmed six-digit PIN and rejects mismatched districts", () => {
    expect(addressErrors({ ...valid, pin: " 411001 " })).toEqual({});
    expect(addressErrors({ ...valid, state: "IN.13" }).district).toBe("Choose a district.");
    expect(addressErrors({ ...valid, country: "unknown" }).country).toBe("Choose a country.");
  });
  it("supports international alphanumeric postal codes without losing leading zeros", () => {
    const states = [{ code: "GB.ENG", name: "England", districts: [{ code: "GB.ENG.LON", name: "London" }] }];
    const address = { ...valid, country: "GB", state: "GB.ENG", district: "GB.ENG.LON", city: "London", pin: "SW1A 1AA" };
    expect(addressErrors(address, states)).toEqual({});
    expect(addressErrors({ ...address, pin: "<script>" }, states).pin).toBe("Enter a valid postal code.");
    expect(addressRecord({ ...address, pin: "01234" }, states).pin).toBe("01234");
  });
  it("requires names for locations entered through Other / not listed", () => {
    const address = { ...valid, state: OTHER_LOCATION, district: OTHER_LOCATION };
    expect(addressErrors(address).stateName).toBeTruthy();
    expect(addressErrors({ ...address, stateName: "New State" }).districtName).toBeTruthy();
    const complete = { ...address, stateName: " New State ", districtName: " New District " };
    expect(addressErrors(complete)).toEqual({});
    expect(addressRecord(complete, INDIA_STATES)).toMatchObject({ stateName: "New State", districtName: "New District" });
  });
  it("allows absent administrative levels and postal codes for countries without them", () => {
    expect(addressErrors({ ...valid, country: "VA", state: NOT_APPLICABLE, district: NOT_APPLICABLE, city: "Vatican City", pin: "00120" }, [])).toEqual({});
    expect(addressErrors({ ...valid, country: "AQ", state: NOT_APPLICABLE, district: NOT_APPLICABLE, city: "Research station", pin: "" }, [])).toEqual({});
    expect(addressErrors({ ...valid, state: NOT_APPLICABLE, district: NOT_APPLICABLE }).state).toBeTruthy();
  });
  it("trims structured fields and keeps a readable combined address", () => {
    expect(addressRecord({ ...valid, addressLine1: " 12 School Road ", addressLine2: " Near park " }, INDIA_STATES)).toMatchObject({ addressLine1: "12 School Road", addressLine2: "Near park", countryName: "India", stateName: "Maharashtra", districtName: "Pune", address: "12 School Road\nNear park\nPune, Maharashtra, 411001\nIndia" });
  });
});
