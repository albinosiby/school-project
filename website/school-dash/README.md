# Edvio school dashboard

Independent Next.js app for school administrators. All school routes and features are in this folder's `src/`;
static assets are in `public/`. Firebase configuration belongs in this app's `.env.local`.

Install dependencies once with `npm ci` in `website/`. From this folder:

- `npm run dev`: school dashboard on port 3000.
- `npm run build` and `npm start`: production build and server.
- `npm test`, `npm run typecheck`, `npm run lint`: app-specific checks.

In **School setup → Bell Schedule**, use **Add break** for each morning break, lunch, or afternoon break.
Enter its name, start time, and duration in minutes; **Remove** deletes an entry. Breaks are saved in chronological
order and must fit within the school day without overlapping. The preview keeps each lesson at its configured
length, moves it after any break it would cross, and shows unallocated time. Check the resulting end time before
saving. Previously saved snack/lunch schedules retain their timings when reopened.

In **School setup → Classes & Sections**, configure LKG–10 by class. For Grades 11 and 12, enable Science,
Commerce, and/or Humanities independently, then set each stream's section count and seats per section. Letters
restart within each stream: 11 Science A and 11 Commerce A are separate classes. Save this step before fees.

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
Transportation is configured separately under **Transport → Buses → Edit bus**, using a monthly fee per assigned
student. Each bus has its own rate; leave it blank until decided or enter 0 for free transport. General fee setup
and whole-class fee batches exclude transport items, including entries from older grade plans. Existing invoices
are unchanged, and historical grade-level transport fields are not copied into bus rates.
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
