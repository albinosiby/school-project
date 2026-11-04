import { COUNTRIES, INDIA_STATES, NOT_APPLICABLE, OTHER_LOCATION, type AddressState } from "./locations";

export type SchoolAddress = {
  addressLine1: string;
  addressLine2: string;
  country: string;
  state: string;
  stateName?: string;
  district: string;
  districtName?: string;
  city: string;
  pin: string;
};

export function addressErrors(v: SchoolAddress, states: AddressState[] = INDIA_STATES) {
  const errors: Record<string, string> = {};
  if (!v.addressLine1.trim()) errors.addressLine1 = "Address line 1 is required.";
  else if (v.addressLine1.trim().length > 200) errors.addressLine1 = "Use no more than 200 characters.";
  if (v.addressLine2.trim().length > 200) errors.addressLine2 = "Use no more than 200 characters.";
  const validCountry = COUNTRIES.some((c) => c.code === v.country);
  if (!validCountry) errors.country = "Choose a country.";
  const state = states.find((s) => s.code === v.state && s.code.startsWith(`${v.country}.`));
  const customState = v.state === OTHER_LOCATION && validCountry;
  if (customState && (!v.stateName?.trim() || v.stateName.trim().length > 100)) errors.stateName = "Enter a state name (up to 100 characters).";
  if (!state && !customState && !(validCountry && !states.length && v.state === NOT_APPLICABLE)) errors.state = "Choose a state.";
  const districts = state?.districts ?? [];
  const customDistrict = v.district === OTHER_LOCATION && !!v.state && !errors.state && !errors.stateName;
  if (customDistrict && (!v.districtName?.trim() || v.districtName.trim().length > 100)) errors.districtName = "Enter a district name (up to 100 characters).";
  if (!customDistrict && !districts.some((d) => d.code === v.district) && !(v.state && !errors.state && !errors.stateName && !districts.length && v.district === NOT_APPLICABLE)) errors.district = "Choose a district.";
  if (!v.city.trim()) errors.city = "City is required.";
  else if (v.city.trim().length > 100) errors.city = "Use no more than 100 characters.";
  const postalRequired = v.country === "IN" || COUNTRIES.find((c) => c.code === v.country)?.postalCodeRequired;
  if (!v.pin.trim() && postalRequired) errors.pin = v.country === "IN" ? "PIN code is required." : "Postal code is required.";
  else if (v.country === "IN" && !/^[1-9]\d{5}$/.test(v.pin.trim())) errors.pin = "Enter a valid 6-digit PIN code.";
  else if (v.country !== "IN" && v.pin.trim() && !/^[\p{L}\p{N}][\p{L}\p{N} .-]{0,19}$/u.test(v.pin.trim())) errors.pin = "Enter a valid postal code.";
  return errors;
}

/** Keep the combined address for Settings and older consumers. */
export function addressRecord(v: SchoolAddress, states: AddressState[]) {
  const state = states.find((s) => s.code === v.state);
  const countryName = COUNTRIES.find((c) => c.code === v.country)?.name ?? "";
  const stateName = v.state === OTHER_LOCATION ? v.stateName?.trim() ?? "" : state?.name ?? "";
  const districtName = v.district === OTHER_LOCATION ? v.districtName?.trim() ?? "" : state?.districts.find((d) => d.code === v.district)?.name ?? "";
  const addressLine1 = v.addressLine1.trim(), addressLine2 = v.addressLine2.trim(), city = v.city.trim(), pin = v.pin.trim();
  const locality = [city, districtName, stateName, pin].filter((part, i, all) => part && all.findIndex((other) => other.toLocaleLowerCase() === part.toLocaleLowerCase()) === i).join(", ");
  return {
    addressLine1, addressLine2, country: v.country, countryName, state: v.state, stateName, district: v.district, districtName, city, pin,
    address: [addressLine1, addressLine2, locality, countryName].filter(Boolean).join("\n"),
  };
}
