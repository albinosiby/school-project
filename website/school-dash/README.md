# Edvio school dashboard

Independent Next.js app for school administrators. All school routes and features are in this folder's `src/`;
static assets are in `public/`. Firebase configuration belongs in this app's `.env.local`.

Install dependencies once with `npm ci` in `website/`. From this folder:

- `npm run dev`: school dashboard on port 3000.
- `npm run build` and `npm start`: production build and server.
- `npm test`, `npm run typecheck`, `npm run lint`: app-specific checks.

List pages share a responsive `ListToolbar` for searches, filters and actions. Desktop filters use compact
widths; mobile search and actions fill the row, with filters arranged in two columns. `DataTable` uses the same
layout automatically. Keep full-width form fields inside their existing forms; use toolbar slots for list controls.

In **School setup → Bell Schedule**, use **Add break** for each morning break, lunch, or afternoon break.
Enter its name, start time, and duration in minutes; **Remove** deletes an entry. Breaks are saved in chronological
order and must fit within the school day without overlapping. The preview keeps each lesson at its configured
length, moves it after any break it would cross, and shows unallocated time. Check the resulting end time before
saving. Previously saved snack/lunch schedules retain their timings when reopened.

In **School setup → Classes & Sections**, configure LKG–10 by class. For Grades 11 and 12, enable Science,
Commerce, and/or Humanities independently, then set each stream's section count and seats per section. Letters
restart within each stream: 11 Science A and 11 Commerce A are separate classes. Save this step before fees.

In **Settings → Classes & Sections**, use **Add grade** for LKG/UKG and Grades 1–10. The three steps are:
enter the grade's total seats; choose its section count and adjust each section's seats to match that total;
then select at least one subject. Section seats start with an even split and can be changed individually.
Each section also has an optional **Room number** field in step 2. The room is saved to that section's class
record and appears on its class details page; room numbers must be distinct and at most 20 characters.
Choose **Add a new subject** to create one in the shared subject list, just as in the senior department form.
These subjects automatically appear in the teacher profile's **Subject** dropdown and **Additional subjects** list.
Subject and department setup lives under **Classes & Sections**; there is no separate **Subjects & Departments** tab.
Use **Back** to review or change an earlier step before creating the grade. Open an existing grade
and choose **Edit sections and capacity** to add sections or change their seats. Saving updates the grade total,
individual class capacities and admissions capacity together. A section cannot be reduced below its enrollment,
and the grade total must cover enrolled students, live admission offers and reserved seats. Removing an empty
section deletes its class record, subject-teacher assignments and weekly timetable; historical attendance,
exam results and student records are retained. Existing admissions reservation settings are preserved.
For configured regular grades, **Edit admissions seats** links to the grade page to keep capacities consistent.
Previously configured grades are synchronized when their sections and capacity are next saved.

On a grade's **Subjects and teachers** table, select a teacher in each subject/division cell. Choices come from
teaching profiles' primary and additional subjects and match by subject name regardless of capitalization or
extra spaces. Each change saves automatically to the shared class assignments; choose **Not assigned** to clear
one. A teacher can cover several divisions. Existing assignments remain visible if the teacher's profile no
longer qualifies, with guidance to update the profile or choose a replacement. Class-teacher responsibility is
managed separately on the class details page.

On **Classes & Assignments → class details → Teachers**, each row has an **Unassign** action.
**Unassign teaching** removes that teacher's subject assignments for the class and clears their identity from
its weekly timetable slots together. The slots, subjects, recorded attendance and other classes are kept.
For the class teacher, **Unassign class teacher** removes only that role; teaching duties can be removed separately.
The dialog reviews the affected counts, and changed assignments must be reviewed again before removal.

Use **Assign room** or **Change room** in the class details header to update its home room. Room names/numbers
are limited to 20 characters and cannot match another class's home room (ignoring case and extra spaces).
Leave the field blank and save to unassign the room.

Configured breaks, including lunch, appear between periods in the daily timetable, weekly timetable and
timetable editor, using the names and timings from the school's bell schedule. Break rows cannot be assigned
teachers or substitutes; teaching period numbers stay the same.
On configured days off, saved lessons and attendance remain visible with regular bell timings for reference
and a **Non-working day** notice. An empty day off does not create scheduled periods.
Weekly, daily and editable timetables use the bell schedule's configured period count. Saved lessons beyond
that count are listed separately for review, and their historical attendance is retained. Below the timetable,
use **School hours & breaks → Edit school timings** to change opening/closing times, daily period count/length
and named breaks including lunch. The editor previews the resulting day and totals for school, teaching and
break hours; overlapping breaks or a schedule running past closing time cannot be saved. This changes bells
for all classes. Academic Year shows the live summary and links to this same editor.

On a teacher's **Staff & HR → staff details** page, **Teacher timetable** shows their recurring weekly
lessons across classes, with subjects, class links, rooms, and shared bell timings including lunch and breaks.
Empty slots show **Free** and simultaneous lessons are flagged as overlaps. The timetable updates when
weekly lessons or school bells change. Teacher IDs determine ownership; legacy name-only lessons appear
only when that name identifies one staff member. Non-teaching profiles do not show this timetable.

On **Students & Guardians → student details**, use **Assign division** (or **Change division**) to choose a
configured division in the student's existing grade. Senior students can choose only within their assigned
department. The picker shows available seats and rechecks enrollment and the division's configured capacity
before saving. A changed division clears the old roll number for the new class teacher to assign; guardian,
transport and historical attendance records are retained. Legacy divisions without an individual capacity can
still be assigned; set their seat limits through **Classes & Sections** to enforce a limit.

In the student details **Transport → Assign Bus / Change Bus** dialog, select a bus and enter the required
**Bus stop**. Suggestions prioritize that bus's stops, then reuse names from other buses in the same school.
Choose a suggestion or **Add “name”**; the stop is created only when **Save assignment** succeeds. Matching
names ignore capitalization and extra spaces. New stops are appended to the selected bus's route without
requiring timings; arrange their order in Transport. Stops and the student's
assignment save together with seat-count checks. Cancelling or a failed save creates no stop.

Fee setup uses the configured classes and streams. Add separate fee items when Science and Commerce have
different amounts; select their class + stream under **Applicable classes**. Grade 12 is configured independently.
Students & Guardians requires the configured stream for senior students. CSV imports have a final `stream`
column (required for 11–12, blank for LKG–10). Existing senior students without a stream must be assigned
explicitly before batch billing. Existing occupied legacy classes and issued invoices are retained.

In **School setup → Fee Structure**, use **Add fee item** or a quick-add template. Set an amount per collection,
frequency, optional first due date, applicable classes, and whether the charge is mandatory, optional, or for new admissions.
Click a fee item's header to expand or collapse its settings. Saved items start collapsed with a name, amount,
frequency, and class-count summary; newly added items appear at the top, newest first, and open automatically.
Collapsing keeps any edits intact.
On **Transport → bus details → Bus management**, assign the driver and attendant in the **Crew** tab.
**Edit bus** uses a single **Final stop name** for the route's end-point location. Bus-wide pickup/drop start
times and individual stop timing fields are omitted; existing saved times are retained for compatibility.
The top summary cards show only each person's name and mobile number. Changes save immediately. Choosing someone on another bus moves them to
this bus and frees the previous seat holder; **Unassigned** clears only this bus's selected role.
Inactive crew are unavailable for new assignments, and old or missing crew references can still be cleared.
In **Transport → Drivers / Bus staff**, click a name or its row to open staff details. Saved staff/crew links
resolve to the existing Staff & HR profile, including its protected HR information and actions. Older Transport-only
records show their saved contact, emergency, employment, licence, attendance and bus details without creating a
new staff record. Profile navigation is available to school administrators.
The **Students** tab shows a searchable assigned roster with stop selection and removal actions. Use **Add students**
to open the selection drawer, filter by grade/section or search, and choose a shared stop. Selections remain picked
across filters; capacity is checked before saving. **Stops** lists the route order, stop names, landmarks and rider counts. Use **Edit stops** to update the existing route configuration.
**Edit bus** uses one **Final stop name** field for the bus's end point. Pickup/drop start-time inputs are
omitted, as are individual stop timing fields and pending-time warnings. Existing timing values are retained for compatibility; stop validation only requires unique names.

Transportation fees are amounts set **per student**, without a built-in billing period. Enter an amount during
bus assignment (including **Add students**) or use **Student details → Transport → Edit transport** to change
the bus, stop or amount. Blank means **Not configured**; 0 means free transport. The bus roster fee column stays read-only.
Set the collection frequency separately under **Settings → Payments → Transport payments** (Monthly, Quarterly,
Half-yearly, Term-wise, Annual or One-time). This preference does not automatically generate invoices.
The Buses directory omits fee totals. Old bus-wide and grade-level amounts are not applied automatically. Fee settings are stored separately from student records in the school-scoped,
admin-only `student_transport_fees` collection. Saving a fee never issues or changes an invoice.
Moving a student to another bus accepts a new amount and saves it atomically with the assignment; generic
transfers without a supplied amount and removals clear the old fee. Changing only the stop keeps it. Concurrent fee or assignment changes must be reviewed before saving an older draft. General fee setup and
whole-class fee batches continue to exclude transport items.
The preview estimates mandatory recurring costs for one student; it excludes optional and one-time charges.
Saved legacy annual setup amounts retain their amounts and annual frequency. Existing Fees & Payments records
retain per-term amounts. Due dates can be left blank until collection starts. Fee items and payment
preferences are saved together; saving never issues an invoice. Late fees and payment-method choices are stored
preferences, not automatic charges or gateway activation.

Under **Fees & Payments**, updated grade plans can be edited and used for batch invoices by collection frequency
and a named billing period. Batch invoices include only mandatory charges for all students. Use **New Invoice**
for optional services or new-admission-only charges, and review the amount and due date before issuing.
The **Notify parents** switch is off by default. When enabled, invoice generation queues an initial parent-app
payment message for each newly billed student. Invoice and reminder records are committed together in chunks;
the existing Firebase reminder trigger delivers messages to the student's linked guardians. Saving fee setup
alone never queues reminders.

Deploy with Firebase Hosting target `admin`. Shared source is in `../shared`, and the other frontends are siblings at
`../landing` and `../superadmin`. See [the workspace guide](../README.md) for setup and deployment commands.

On a bus details page, **Registration and compliance → Update** edits document numbers and validity dates directly.
**History** shows future changes with previous/new values, editor and saved time, including updates through
**Edit vehicle details**. Each history entry saves atomically with the bus; unchanged saves add no history.

The bus **Maintenance** card also has **Update** and **History** actions. Service dates, odometer readings,
service interval and maintenance notes can be updated directly. Future updates record previous/new values,
editor and saved time, including maintenance edits through **Edit vehicle details**. Bus and history save together.

**Transport → Drivers → Add Driver** opens the shared Add Staff profile form with **Non-Teaching → Driver**
preselected. Driver app access starts enabled and uses the same staff profile / app-login steps, employee ID
numbering, validation and password controls as Staff & HR. **Bus staff → Add Bus staff** uses the same form
with **Non-Teaching → Bus Attendant** preselected and app access enabled by default. Existing crew edit
forms retain bus assignment controls.

Student details shows overall academic attendance as a ring chart with the percentage and attended/not-attended
day counts. The configured term dates define the academic year; only recorded days from admission through today
within that calendar are counted. Present and late count as attended; absent and excused count as not attended.
Unmarked days are excluded. Students without marks show 0% with zero day counts; missing calendar dates link to Academic
Year settings. Attendance records are loaded only for the selected student.
The Students list ends with **Attendance %**, using the same academic calendar and calculation as the details
chart. Its average, below-minimum count and CSV attendance values use that same academic-year data. Students without
marks contribute 0% to the average; with no students, the summary shows 0% and 0.

Configure the school's minimum under **Settings → Academic Year → Minimum attendance (%)**. It accepts
0–100 (including decimals) and defaults to 75 until saved. The student summary label/count, attendance warning
colours and attendance/marks report checks all use this policy. The setting saves under
`set_config/attendance_policy.minimumPercent`, preserves other fields and rejects conflicting edits.

Students, Guardians and Staff directories use a compact persistent search bar, removable filter chips, Clear all
and result counts. Student grade/stream/division choices come from configured classes and existing enrolments,
including LKG/UKG. Staff search includes phone/email, and subject/department choices follow the selected staff
category with duplicate spellings grouped by case. Guardian filters cover linked-student count and document status.
External filters reset pagination while preserving sort. Secondary panels and the Add Staff form load on demand;
directory search data, attendance summaries and per-staff leave status are cached between relevant data changes.

**Certificates** has a dedicated sidebar page at `/certificates` for requests, issuing, signed-file uploads,
rejections and printing. It replaces the former Certificates tab in Students & Guardians;
`/students?tab=certificates` redirects to the new page. The existing `/certificate?id=…` print links still work.

Loading feedback uses the shared `LoadingSkeleton` components for route transitions, data panels, forms and previews. Use `LoadingField` when options load inside an existing form so its control, label and value remain mounted. Shimmer is CSS-only, has an accessible loading status, and becomes static with reduced motion. Keep failed reads and retry actions explicit; save/upload buttons retain their operation labels.

Student details includes **Fees** and **Payment history** for school administrators and owners. It shows the configured
fees for the recorded grade/stream and current academic year, plus the student's transport amount with the collection
frequency from Settings → Payments. Billed, paid and outstanding totals come from saved invoices; concessions appear
separately and are not subtracted again. Receipts open the existing view/print dialog. Records match by invoice/student
ID first, with unique GRN matching for legacy records; names are never used to assign financial history. The panels
reuse the existing school-scoped stores, paginate invoices/receipts, show skeletons while loading and provide retry
controls on failure. Opening them creates no invoices or payments, including for removed students viewed read-only.

**Total amount to pay** covers the full configured academic year: required fee collections (Monthly ×12,
Quarterly ×4, Half-yearly ×2, Term-wise × configured term count, Annual/One-time ×1), applicable admission
charges and the student's transport amount at the school's collection frequency, less approved annual concessions
and payments against that year's invoices. Optional items enter the total when invoiced. A previously invoiced
one-time item is not billed again in a later year. Missing calendar, admission eligibility or transport configuration
is called out instead of showing an incomplete payable amount. Existing invoice balances remain separate.

Active students have **Generate invoice** with selected fees, remaining collection counts, billing period, due date
and concession preview. Saving rechecks the student and configuration in a transaction and commits the invoice,
number, collection ledger and concession applications together. Repeating the same request returns its invoice;
changed requests for the same student/year/period are rejected. Only unused approved concession amounts apply.
Saved invoices offer **View / download → Download PDF / Print**. PDFs are created locally with bundled licensed
Noto fonts; no invoice data is sent to an export service. Creating an invoice uses the existing parent-notification
trigger. Removed students retain invoice and receipt viewing/download access, with no invoice creation.

The Fees page opens **Student dues**, listing students with a remaining full-year balance even before invoices
exist. It includes class, guardian/contact, net annual fee, paid amount and remaining balance, with search and grade
filters (including kindergarten). Settled, All and Needs setup views distinguish paid accounts from incomplete fee
configuration. Removed identities remain available for safe GRN matching but stay out of this directory; inactive
enrolments show existing billed debt without estimating new annual charges. The summary counts students with balances.
Financial records are indexed by student/invoice identity before calculating the list and reuse existing listeners.

Click a student to open `/fees/students/{studentId}` for their contact/class information, annual dues, invoices and
payment history. **Create invoice for remaining fees** bills only uninvoiced collections. Existing invoice balances
can be downloaded or shared without another charge. **Share** prepares the PDF and then offers the device share
menu where supported; other browsers offer PDF download for attaching in another app. Nothing is shared automatically.
Issued invoices and their reminders remain in a separate view. Counter Collection and Settlements & Gateway Health
have been removed from this page; the payment verification and historical receipts workflows remain available.

**Collect payment** on student fee details and the profile's Fees section records full or partial collections
against an existing invoice. Enter amount, method, payment date and a transaction reference for non-cash payments.
The `recordFeePayment` callable atomically saves the receipt and updates paid/balance/status. Uncertain requests
are retained in the current tab's session storage, scoped by school, administrator and student; retry confirms the
same receipt rather than submitting another cash collection. Uninvoiced annual fees must be invoiced first.

Each invoice also has **Change status**. Pending/Overdue labels require a reason; Partial/Paid continue to collection,
and Automatic removes the manual label. Settled invoices cannot be made unpaid by changing status. Reasons and
editor details appear in admin-only status history, never in the parent-readable invoice override. A subsequent
payment clears the override; editing the billed amount or due date invalidates it. Web previews, PDFs and the parent
app use the same effective status. Removed students retain read-only financial history.

Deploy `functions:changeFeeInvoiceStatus`, the updated `functions:recordFeePayment`, and Firestore rules together
before using these controls with the hosted backend. No data migration is required. The parent app needs its next
normal release to display manual overrides. Test with synthetic data using
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8873 node tools/rules_test/feeCollections.mjs` from the website root while a local
Firestore emulator is running. This verifies receipt retries, concurrent payments, status audit history, MFA,
tenant restrictions, immutable audit records and protected financial writes without touching live school records.

Invoices use the school logo from **Settings → School Profile** in the paper preview, print view, downloaded PDF
and shared PDF. The A4 template includes the school header, invoice status/number, student and billing details,
quantity/rate columns, concessions, paid amount and a prominent balance due. Long descriptions wrap, and PDF pages
repeat the branded header, table headings and page numbering. PNG/JPEG logos retain their aspect ratio; a failed
logo download gives an explicit retry error instead of exporting a broken image. No configured logo uses a clean
school-name header. Rendering and layout changes do not alter saved invoice amounts or payment records.
