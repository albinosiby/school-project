# Onboarding location reference data

School setup step 1 uses two address lines, country → state → district dropdowns,
city, and PIN/postal code. India is selected initially. Address line 2 is optional.
Indian PINs must have six digits and start with 1–9; international postal codes
remain text, preserving letters and leading zeros. Postal codes are optional for
countries with no postal-code format in the reference data.

## Storage and compatibility

The existing authenticated, school-scoped saves write structured fields into
`schools/{schoolId}/set_config/profile` and the step snapshot in `onb_data/s1.values`:

- `addressLine1`, `addressLine2`, `city`, `pin`: trimmed strings.
- `country`: two-letter country code; `countryName`: display name.
- `state`, `district`: GeoNames administrative codes; `stateName`, `districtName`:
  display names. Codes are namespaced by their country and parent state.
- `other` identifies a manually entered state/district, with its required name.
- `not-applicable` identifies an absent administrative level and has an empty name.
- `address`: a combined, formatted address retained for Settings and existing consumers.

`school/school.city` remains populated for the mobile apps. Existing single-field
addresses load into address line 1. Records are upgraded when the admin saves;
no bulk migration, new API, database, index, rules, or credential is needed.
Changing a parent location clears its dependent fields. Reopening restores the
step snapshot, falling back to the profile document when no snapshot is present.

## Data source and license

Derived from the [GeoNames dump](https://download.geonames.org/export/dump/),
downloaded 2026-11-04: `countryInfo.txt`, `admin1CodesASCII.txt`, and `admin2Codes.txt`.
[GeoNames](https://www.geonames.org/) data is licensed under
[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
The form provides attribution. Data is provided as-is and may lag administrative
changes. “Other / not listed” permits valid addresses missing from the snapshot.
GeoNames admin2 divisions are districts, counties, or equivalent local divisions.

Transformations: retain country/state/district names and codes, sort names,
group by country/continent, use ASCII Indian district names, remove Indian
“District”/“Division” suffixes, and update Ahilyanagar, Chhatrapati Sambhajinagar,
and Dharashiv against the [Maharashtra government directory](https://mahavillages.mahabhumi.gov.in/all_list.php).
These adaptations do not imply endorsement by the sources.

## Refresh

Download the three source files into a temporary directory, then run from `website`:

```sh
node tools/locations/build.mjs /path/to/downloaded/dump
cd school-dash
npm test -- src/features/onboarding/locations.test.ts src/features/onboarding/address.test.ts src/features/onboarding/steps.test.tsx
npm run typecheck
```

Review generated changes before deployment. India is bundled with the form;
other continent packs live in `school-dash/public/data/locations` and load from the same
origin only when needed. Successful requests are shared for the session; failed
requests offer retry and prevent saving until location loading succeeds.
The existing build/deployment pipeline includes these static assets. Rollback
uses the previous application release; new fields are additive and older consumers
can continue reading `address` and `city`.
