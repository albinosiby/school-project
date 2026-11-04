import countries from "./data/countries.json";
import india from "./data/india.json";

export type LocationOption = { code: string; name: string };
export type AddressState = LocationOption & { districts: LocationOption[] };
export const COUNTRIES: (LocationOption & { region: string; postalCodeRequired: boolean })[] = countries;
export const INDIA_STATES: AddressState[] = india;
export const NOT_APPLICABLE = "not-applicable";
export const OTHER_LOCATION = "other";

const regions = new Map<string, Promise<Record<string, AddressState[]>>>();

/** Public reference data only; no form values are sent to a location service. */
export async function loadCountryStates(country: string): Promise<AddressState[]> {
  if (country === "IN") return INDIA_STATES;
  const region = COUNTRIES.find((c) => c.code === country)?.region;
  if (!region) throw new Error("Choose a country.");
  let pending = regions.get(region);
  if (!pending) {
    pending = fetch(`/data/locations/${region}.json`).then(async (response) => {
      if (!response.ok) throw new Error("Location data could not be loaded.");
      return await response.json() as Record<string, AddressState[]>;
    }).catch((error: unknown) => {
      regions.delete(region);
      throw error;
    });
    regions.set(region, pending);
  }
  const data = await pending;
  if (!Array.isArray(data[country])) throw new Error("Location data could not be loaded.");
  return data[country];
}
