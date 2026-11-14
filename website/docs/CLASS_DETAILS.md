# Class details

Open **Classes & Assignments**, then select a class card. Its full page is at
`/classes/{classId}`. The card's **Manage assignments** button still opens the
assignment editor.

- **Overview:** class-teacher name and phone, current scheduled/substitute
  teacher, today’s periods, room, wing, capacity and class totals.
  Use **Set class teacher** or **Change class teacher** on the class-teacher
  card to select a teacher and save. Choose **Not assigned** to unassign them.
  Teachers already assigned as class teacher elsewhere are excluded until
  unassigned there. Saving updates both `classTeacherId` and `classTeacher`
  through the existing school-scoped class record.
- **Timetable:** choose a date, view its periods and assign/reassign a substitute
  for one hour. The class and date are fixed in the editor. It checks teaching,
  existing cover and approved leave before saving. View the recurring weekly
  timetable below. Weekly timetable editing remains in Settings > Timetable.
- **Attendance:** choose a date to see period totals and student marks; choose
  a history month and open a date to inspect its periods.
- **Students:** searchable active roster; names and rows open student profiles.
- **Teachers:** the class teacher plus subject assignments and recurring timetable
  teachers, grouped by staff ID; profiles open from names or rows. The class teacher
  is included even before any subject or timetable period has been assigned.
- **Results:** choose a published exam and view student outcomes and class pass
  percentage. The default is the latest fully published exam, when available.

## Calculation rules

All records use the existing signed-in school scope. Substitution assignment
uses the existing `ops_substitutions` write path and teacher-app status contract.
No new Firebase functions, rules, indexes or schema migrations are required.

Current periods use school time and the same bell settings as class cards.
The teacher shown is scheduled or assigned cover; physical presence is not
tracked by these records.

Hourly attendance uses only submitted, undeleted records with period > 0.
The newest revision of each date/period wins. Present plus late counts as
attended. Missing records show **Not marked**. A historical sparse roll cannot
establish an omitted student's presence without a saved roster, so those cells
show **Unavailable** while saved period totals remain visible. Students admitted
after a record's date show **Not enrolled**.

Pass percentage = passed students / assessed students × 100. A student must
pass all covered papers under the selected cycle's 33% aggregate or independent
component rule. Only complete published outcomes enter the denominator.
Absence/disqualification counts as failed; missing, invalid, conflicting,
unpublished and medical re-exam outcomes remain pending/unavailable. Empty
results show **Not available**, while a fully assessed failing class shows 0%.

The existing shared collection cache supplies the screen. Lists paginate in
the browser. Displayed teacher contacts load through the existing admin-only
staff profile service, including the class-teacher card. Loading and retry states
are shown separately from a genuinely missing phone number. Contacts stay in
the protected HR record rather than being copied to the shared staff summary.
