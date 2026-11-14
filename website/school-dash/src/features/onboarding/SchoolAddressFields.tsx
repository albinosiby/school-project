"use client";
import { useEffect, useState } from "react";
import { useCollection } from "@/lib/useCollection";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Grid } from "./FormBits";
import type { SchoolAddress } from "./address";
import { COUNTRIES, INDIA_STATES, loadCountryStates, NOT_APPLICABLE, OTHER_LOCATION, type AddressState } from "./locations";

const EMPTY_STATES: AddressState[] = [];

export function useAddressLocations(country: string) {
  const [result, setResult] = useState<{ country: string; states: AddressState[]; error?: string }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (country === "IN" || !country) return;
    let active = true;
    loadCountryStates(country).then(
      (states) => { if (active) setResult({ country, states }); },
      () => { if (active) setResult({ country, states: EMPTY_STATES, error: "Could not load states and districts. Please try again." }); },
    );
    return () => { active = false; };
  }, [country, attempt]);
  const current = result?.country === country ? result : undefined;
  return {
    states: country === "IN" ? INDIA_STATES : current?.states ?? EMPTY_STATES,
    loading: !!country && country !== "IN" && !current,
    error: country === "IN" ? undefined : current?.error,
    retry: () => { setResult(undefined); setAttempt((n) => n + 1); },
  };
}

export function useAddressCitySuggestions() {
  const school = useCollection<{ id: string; state?: string; district?: string; city?: string }>("school").rows.find((row) => row.id === "school");
  const admissions = useCollection<{ id: string; residence?: SchoolAddress }>("adm_student_details").rows;
  return (address: SchoolAddress) => [...new Set([
    ...(school?.city && school.state === address.state && school.district === address.district ? [school.city] : []),
    ...admissions.flatMap(({ residence }) => {
      const city = residence?.city?.trim();
      return city && residence?.country === address.country && residence.state === address.state && residence.district === address.district ? [city] : [];
    }),
  ])].sort();
}

export function SchoolAddressFields({ value: v, onChange, errors, states, loading, error, retry, disabled, cityOptions, required = true, legend, postalMaxLength = 20 }: {
  value: SchoolAddress;
  onChange: (patch: Partial<SchoolAddress>) => void;
  errors: Record<string, string>;
  states: AddressState[];
  loading: boolean;
  error?: string;
  retry: () => void;
  disabled: boolean;
  cityOptions?: string[];
  required?: boolean;
  legend?: string;
  postalMaxLength?: number;
}) {
  const districts = states.find((s) => s.code === v.state)?.districts ?? [];
  const [manualCityDistrict, setManualCityDistrict] = useState<string>();
  const cityIsManual = manualCityDistrict === v.district || (!!v.city && !cityOptions?.includes(v.city));
  const indian = v.country === "IN";
  const postalRequired = required && (indian || !!COUNTRIES.find((c) => c.code === v.country)?.postalCodeRequired);
  return (
    <fieldset className="min-w-0 space-y-4" disabled={disabled}>
      <legend className="sr-only">{legend ?? (cityOptions ? "Student address" : "School address")}</legend>
      <Field label="Address line 1" required={required} error={errors.addressLine1}>
        {cityOptions ? <Textarea value={v.addressLine1} onChange={(e) => onChange({ addressLine1: e.target.value })} maxLength={200} required={required} aria-invalid={!!errors.addressLine1} /> : <Input value={v.addressLine1} onChange={(e) => onChange({ addressLine1: e.target.value })} autoComplete="address-line1" placeholder="Building number and street" maxLength={200} required={required} aria-invalid={!!errors.addressLine1} />}
      </Field>
      <Field label="Address line 2" hint="Optional" error={errors.addressLine2}>
        <Input value={v.addressLine2} onChange={(e) => onChange({ addressLine2: e.target.value })} autoComplete="address-line2" placeholder="Area, locality or landmark" maxLength={200} aria-invalid={!!errors.addressLine2} />
      </Field>
      <Grid>
        <Field label="Country" required={required} error={errors.country}>
          <Select value={v.country} onChange={(e) => onChange({ country: e.target.value, state: "", stateName: "", district: "", districtName: "", city: "", pin: "" })} autoComplete="country" required={required} aria-invalid={!!errors.country}>
            <option value="">Select country</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="State" required={required} error={errors.state}>
          <Select value={v.state} onChange={(e) => onChange({ state: e.target.value, stateName: "", district: "", districtName: "", city: "", pin: "" })} autoComplete="address-level1" disabled={!v.country || loading || !!error} required={required} aria-invalid={!!errors.state}>
            <option value="">{loading ? "Loading states…" : "Select state"}</option>
            {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            {v.country && !loading && !error && !states.length && <option value={NOT_APPLICABLE}>Not applicable</option>}
            <option value={OTHER_LOCATION}>Other / not listed</option>
          </Select>
        </Field>
        {v.state === OTHER_LOCATION && <Field label="State name" required={required} error={errors.stateName}><Input value={v.stateName ?? ""} onChange={(e) => onChange({ stateName: e.target.value })} maxLength={100} required={required} aria-invalid={!!errors.stateName} /></Field>}
        <Field label="District" required={required} error={errors.district}>
          <Select value={v.district} onChange={(e) => onChange({ district: e.target.value, districtName: "", city: "", pin: "" })} disabled={!v.state || loading || !!error} required={required} aria-invalid={!!errors.district}>
            <option value="">{v.state ? "Select district" : "Select state first"}</option>
            {districts.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            {v.state && !loading && !error && !districts.length && <option value={NOT_APPLICABLE}>Not applicable</option>}
            <option value={OTHER_LOCATION}>Other / not listed</option>
          </Select>
        </Field>
        {v.district === OTHER_LOCATION && <Field label="District name" required={required} error={errors.districtName}><Input value={v.districtName ?? ""} onChange={(e) => onChange({ districtName: e.target.value })} maxLength={100} required={required} aria-invalid={!!errors.districtName} /></Field>}
        {cityOptions && <Field label="City" required={required} error={cityIsManual ? undefined : errors.city}>
          <Select value={cityIsManual ? OTHER_LOCATION : v.city} disabled={!v.district} onChange={(e) => {
            const other = e.target.value === OTHER_LOCATION;
            setManualCityDistrict(other ? v.district : undefined);
            onChange({ city: other ? "" : e.target.value });
          }}>
            <option value="">Select city</option>
            {cityOptions.map((city) => <option key={city}>{city}</option>)}
            <option value={OTHER_LOCATION}>Other / not listed</option>
          </Select>
        </Field>}
        {(!cityOptions || cityIsManual) && <Field label={cityOptions ? "City name" : "City"} required={required} error={errors.city}>
          <Input value={v.city} onChange={(e) => onChange({ city: e.target.value })} autoComplete="address-level2" maxLength={100} required={required} aria-invalid={!!errors.city} />
        </Field>}
        <Field label={indian ? "PIN code" : "Postal code"} required={postalRequired} hint={postalRequired ? undefined : required ? "Optional for this country" : "Optional"} error={errors.pin}>
          <Input value={v.pin} onChange={(e) => onChange({ pin: e.target.value })} autoComplete="postal-code" inputMode={indian ? "numeric" : "text"} placeholder={indian ? "e.g. 682001" : "Postal code"} maxLength={indian ? 6 : postalMaxLength} required={postalRequired} aria-invalid={!!errors.pin} />
        </Field>
      </Grid>
      {error && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-error">{error}<Button type="button" variant="outline" onClick={retry}>Try again</Button></div>}
      <p className="text-xs text-outline">Location data adapted from <a className="underline" href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> (<a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>).</p>
    </fieldset>
  );
}
