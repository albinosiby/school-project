# Admin dashboard → mobile alignment

The maintained Teacher, Parent and Driver/Attendant apps consume the same school configuration and records as the admin dashboard. Their next version is **1.0.1+2**. The separate `staff` directory remains the original Flutter starter; it is not a working employee app or an admin app.

**Release verification, 21 November 2026:** all 17 targeted backend functions are ACTIVE in `asia-south1`; the timetable index is READY and document-token TTL is ACTIVE. All unrelated function hashes are unchanged. Anonymous callable probes returned HTTP 401/UNAUTHENTICATED. All three Firebase-backed Android debug APKs built successfully as version 1.0.1+2. Source analysis is clean and 78 focused tests passed. APK checksums and sanitized deployment metadata are recorded in `website/docs/deployments/mobile-alignment-2026-11-21.json`. Device acceptance testing and signed store distribution have not been performed.

## Implemented

- **Shared policy:** school academic dates/terms, attendance minimum, working days, timezone offset and the exact dashboard bell schedule. Configuration contains only allowlisted mobile fields, published under `schools/{sid}/school/mobile`; bank credentials and other admin configuration are not copied into it.
- **Teacher:** configured periods, break names/durations, class-room fallback, real clock outside school hours, calendar-based week labels, kindergarten/senior class identities, academic-year attendance and configurable warnings. Lesson/test subject choices are limited to profile subjects assigned in the selected class. Class histories include other teachers' submitted attendance; editing another teacher's sheet is rejected. Official personal staff certificates are available from Profile.
- **Parent:** live division/class-teacher changes, configured timetable with breaks and dated substitutes, academic-year attendance including no-data 0%, and full-year fee obligations before invoicing. Annual transport amount/frequency and approved concessions use the dashboard calculation. Invoice balance uses its saved net amount. Office collections and manual Pending/Overdue labels update from existing records; reported payments remain unverified until the office accepts them. Saved invoices and receipts open protected PDFs in the device viewer, where they can be downloaded, printed or shared. Certificate request rejection reasons and revoked states are retained.
- **Driver/attendant:** reassignment cancels old bus listeners, occupied/available seats use the actual student roster, and final stop/vehicle/student seat counts come from admin records. Legacy stop timing fields are no longer read or serialized. Official personal certificates are available from Profile.
- **Common UI:** shimmer loading with reduced-motion support and installed version/build information on Profile.

## Backend contract and release order

1. From `website`, run `node tools/build_mobile_domain.cjs`. It packages the dashboard's pure fee, class, attendance and bell-schedule code into `functions/mobileFeeDomain.js`. Regenerate after changing those dashboard domain files. It deliberately excludes browser/Firebase client code.
2. Deploy the composite `ops_substitutions(classId,date)` index and the `mobile_document_tokens.deleteAt` TTL from `firestore.indexes.json`. Existing Firestore rules continue to protect school data; no general mobile permission to read `set_config`, concessions, transport-fee records or salary certificates was added.
3. Deploy these functions to the existing project, `school-admin-tatos-2610`, **before distributing the mobile builds**:

   - `getMobileSchoolContext`, `getMobileStudentFees`, `getMobileStudentTimetable`, `getMobileStaffCertificates`
   - `downloadMobileFeeDocument`, `mobileFeeFile`
   - `onMobileSettingsChanged`, `onMobileTermsChanged`, `onMobileSchoolChanged`, `onMobileFeePlanChanged`
   - `onMobileAttendanceChanged`, `onMobileAdmissionChanged`, `onMobileSubstitutionChanged`, `onMobileTransportFeeChanged`, `onMobileConcessionChanged`
   - Updated `downloadCertificate` and `certificateFile` for staff self-access.

4. Build each mobile app with `--dart-define=BACKEND=firebase`. Local demo mode remains separate. Emulator builds also set `EMULATOR=true`, `EMULATOR_HOST` and optionally `EMULATOR_USB=true` as before.

The first authenticated settings call bootstraps older schools. Attendance projections on students are derived from `par_attendance`, academic dates and admission date, and are maintained using transactions. Parent/teacher startup fills missing projections for their linked/assigned students; a teacher's live calendar change also refreshes those summaries. Class substitution and individual fee updates invalidate only the affected student records. Old bus listeners are cancelled on reassignment.

All callable endpoints derive the school and recipient from the authenticated user document. Parents can request only linked students' summaries and documents. Staff can view only certificates addressed to their linked staff ID. PDF bearer links expire after five minutes and recheck current ownership, login version, school suspension and record availability before returning a file. Revoked certificates cannot be opened.

## Validation

- `node --test functions/mobileSync.test.js functions/certificates.test.js`
- Teacher: `flutter test --dart-define=BACKEND=firebase test/mobile_alignment_test.dart`
- Parent: `flutter test test/mobile_alignment_test.dart test/certificate_records_test.dart test/invoice_status_test.dart test/home_behaviour_test.dart test/home_ui_test.dart`
- Driver: `flutter test test/mobile_alignment_test.dart test/firebase_repositories_test.dart`
- Shared package: run `flutter test` in `mobile app/school_sync`.
- Analyze all three apps and `school_sync`; build Android APKs with the Firebase backend selected.
- Invoice and receipt PDFs are rendered for visual inspection; a multi-page ledger test verifies A4 continuation pages.

The existing parent `firebase_repositories_more_test.dart` still references the removed `sendPasswordReset` API. Its old authentication expectations must be updated separately; it is excluded from the focused alignment checks. No production payments or certificates are created by the tests.
