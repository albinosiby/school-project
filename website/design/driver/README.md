# Driver app design coverage

Source: [School Admin Web — Driver App](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-2). Extracted through the connected local Figma bridge on 29 October 2026.

The 62 source frames map to native Flutter views in `mobile app/driver`. Runtime assets are individual illustrations, icons, maps, profile images and decorative elements. Full reference screenshots are retained here for review only.

## Reproduce the view contracts

From the repository root, with Python and Pillow installed:

```sh
python3 website/tools/figma_bridge/build_driver_views.py
```

`spec/` contains source frame trees; `coordinates.json`, `view_properties.json` and `text_runs.json` preserve placement, paint bounds, visibility, clipping, alignment and mixed font emphasis. `asset_nodes.json` records exported graphic nodes. `source_assets/` preserves SVG/PNG export originals and export notes. A `.error` file records a node Figma could not export (usually an invisible/empty layer); these files are excluded from runtime references.

`mobile app/driver/assets/figma/` contains the rasterized local graphics at 2× source resolution. Fonts are bundled for offline rendering. Avoid editing generated contracts by hand; change the generator or refresh the source export.

## Frame coverage

| Role | Figma frame | Name | App route |
| --- | --- | --- | --- |
| assistant | [1174:4](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-4) | 2 Assistant Home | `/assistant/home` |
| assistant | [1174:330](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-330) | 14 Notifications | `/screen/330` |
| assistant | [1174:475](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-475) | 13.1 Module Detail | `/screen/475` |
| assistant | [1174:729](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-729) | 14.1 Notifications Detail  | `/screen/729` |
| assistant | [1174:788](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-788) | 15 Profile  | `/screen/788` |
| assistant | [1174:1058](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-1058) | 16 Digital Pass / ID | `/screen/1058` |
| assistant | [1174:1289](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-1289) | 5 Student care notes (on-bus) | `/screen/1289` |
| assistant | [1174:1433](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-1433) | 6 Guardian Handover | `/screen/1433` |
| assistant | [1174:1720](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-1720) | 2.1 View Stops (8 Stops) | `/assistant/stops` |
| assistant | [1174:2296](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-2296) | 2.2. Seat & Count | `/screen/2296` |
| assistant | [1174:2707](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-2707) | 7 Unknown / extra child handling | `/screen/2707` |
| assistant | [1174:2980](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-2980) | 8 Attendant end-of-trip check | `/screen/2980` |
| assistant | [1174:3322](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-3322) | 9 On-bus incident report (attendant) | `/screen/3322` |
| assistant | [1174:3631](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-3631) | 10 Crew quick messages | `/screen/3631` |
| assistant | [1174:3868](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-3868) | 11 My scan & verification log | `/screen/3868` |
| assistant | [1174:4193](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-4193) | 12 Attendant duty roster | `/assistant/duties` |
| assistant | [1174:4589](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-4589) | 12.1 Swap (Popup) | `/screen/4589` |
| assistant | [1174:4772](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-4772) | 13 Students | `/assistant/students` |
| assistant | [1174:5017](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-5017) | 13 Attendant onboarding & training | `/screen/5017` |
| driver | [1174:5271](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-5271) | 1.Home | `/driver/home` |
| driver | [1174:5638](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-5638) | 2. Trips | `/driver/trips` |
| driver | [1174:6027](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-6027) | 2.1 Afternoon Drop | `/screen/6027` |
| driver | [1174:6416](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-6416) | 3. Live | `/driver/live` |
| driver | [1174:6922](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-6922) | 4. Profile | `/driver/profile` |
| driver | [1174:7347](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-7347) | 5. Notifications | `/screen/7347` |
| driver | [1174:7566](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-7566) | Onboarding 5 | `/screen/7566` |
| driver | [1174:7629](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-7629) | Onboarding 6 | `/screen/7629` |
| driver | [1174:7759](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-7759) | Onboarding 7 | `/screen/7759` |
| driver | [1174:7892](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-7892) | Onboarding 8 | `/screen/7892` |
| driver | [1174:8132](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-8132) | 1.11 Apply Leave | `/screen/8132` |
| driver | [1174:8359](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-8359) | 1.11.1 Change Driver (Popup) | `/screen/8359` |
| driver | [1174:8483](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-8483) | 1.11.1 Leave History  | `/screen/8483` |
| driver | [1174:8717](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-8717) | 1.11.1.1 Leave View Details | `/screen/8717` |
| driver | [1174:8829](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-8829) | 5.1 Notification Detail | `/screen/8829` |
| driver | [1174:8924](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-8924) | 4.1 Edit Profile | `/screen/8924` |
| driver | [1174:9182](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-9182) | 4.2 Settings | `/screen/9182` |
| driver | [1174:9379](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-9379) | 4.1.1 Change Profile Image (Popup) | `/screen/9379` |
| driver | [1174:9484](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-9484) | 4.11 Show Digital Pass / ID | `/screen/9484` |
| driver | [1174:9679](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-9679) | 4.11.1 QR Code (Popup) | `/screen/9679` |
| driver | [1174:9783](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-9783) | 1.1 Pre - Trip Checklist | `/screen/9783` |
| driver | [1174:10127](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-10127) | 1.2 Student Manifest | `/screen/10127` |
| driver | [1174:10392](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-10392) | 1.4 Trip History | `/screen/10392` |
| driver | [1174:10742](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-10742) | 1.4.1 View History | `/screen/10742` |
| driver | [1174:11153](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-11153) | 1.12 Lost & Found | `/screen/11153` |
| driver | [1174:11370](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-11370) | 1.12.1 Returned | `/screen/11370` |
| driver | [1174:11710](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-11710) | 1.12.1 Returned Item Detail | `/screen/11710` |
| driver | [1174:11926](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-11926) | 1.12.3  Report Found Item | `/screen/11926` |
| driver | [1174:12168](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-12168) | 1.12.2.1  Message Office | `/screen/12168` |
| driver | [1174:12354](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-12354) | 1.12.2 Lost Item Detail | `/screen/12354` |
| driver | [1174:12538](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-12538) | 1.13 Fuel Log | `/screen/12538` |
| driver | [1174:12802](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-12802) | 1.14 Transport Notices | `/screen/12802` |
| driver | [1174:12995](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-12995) | 1.14.1 Transport Notice Detail | `/screen/12995` |
| driver | [1174:13069](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-13069) | 1.3.1 View Service Schedule | `/screen/13069` |
| driver | [1174:13368](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-13368) | 1.4.11 Score Analysis | `/screen/13368` |
| driver | [1174:13666](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-13666) | 1.4.12 View All (Payslips | `/screen/13666` |
| driver | [1174:13983](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-13983) | 1.3.2 Report Vehicle Fault | `/screen/13983` |
| driver | [1174:14244](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-14244) | 1.15 End Active TripvSubmit | `/screen/14244` |
| driver | [1174:14506](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-14506) | 1.4.1.1 View Boarded Students (Popup) | `/screen/14506` |
| driver | [1174:14717](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-14717) | 1.3 Vehicle Details | `/screen/14717` |
| driver | [1174:15003](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-15003) | 1 Crew Role & Pairing | `/screen/15003` |
| driver | [1174:15282](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-15282) | 1.1 Crew Role & Pairing | `/screen/15282` |
| driver | [1174:15553](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-15553) | 3 Pair to driver's trip / take over | `/screen/15553` |
