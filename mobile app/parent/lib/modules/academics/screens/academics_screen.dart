import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../attendance/screens/attendance_view.dart';
import '../../family/screens/widgets/parent_tab_header.dart';
import '../../homework/screens/homework_list.dart';
import '../../marks/screens/marks_list.dart';
import '../../timetable/screens/timetable_view.dart';

/// The four sections of the Academics tab, in dock order. `?section=` uses the lower-case names.
enum AcademicSection { attendance, homework, marks, timetable }

extension AcademicSectionX on AcademicSection {
  String get label => switch (this) {
    AcademicSection.attendance => 'Attendance',
    AcademicSection.homework => 'Homework',
    AcademicSection.marks => 'Marks',
    AcademicSection.timetable => 'Timetable',
  };

  static AcademicSection parse(String? q) => AcademicSection.values.firstWhere(
    (s) => s.name == q?.toLowerCase(),
    orElse: () => AcademicSection.attendance,
  );
}

/// Academics tab: attendance, homework, marks and timetable behind one segmented control.
/// The selected section lives in the URL (`/academics?section=marks`) so deep links and the Home
/// shortcuts land on the right section.
class AcademicsScreen extends StatelessWidget {
  const AcademicsScreen({super.key, this.section});

  /// attendance | homework | marks | timetable (from the `?section=` query).
  final String? section;

  @override
  Widget build(BuildContext context) {
    final current = AcademicSectionX.parse(section);
    return ColoredBox(
      color: C.surface,
      child: Column(
        children: [
          const ParentTabHeader(title: 'Academics'),
          Padding(
            padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 0),
            child: Container(
              padding: EdgeInsets.all(4.r),
              decoration: BoxDecoration(
                color: C.surfaceLow,
                borderRadius: BorderRadius.circular(R.md),
                border: Border.all(color: C.outline.withValues(alpha: .6)),
              ),
              child: AppSegmented(
                key: const Key('academics-sections'),
                items: [for (final s in AcademicSection.values) s.label],
                value: current.label,
                track: true,
                onChanged: (v) {
                  final next = AcademicSection.values.firstWhere(
                    (s) => s.label == v,
                  );
                  if (next != current) {
                    context.go(RoutePaths.academicsSection(next.name));
                  }
                },
              ),
            ),
          ),
          Expanded(
            child: KeyedSubtree(
              key: ValueKey(current),
              child: switch (current) {
                AcademicSection.attendance => const AttendanceView(),
                AcademicSection.homework => const HomeworkList(),
                AcademicSection.marks => const MarksList(),
                AcademicSection.timetable => const TimetableView(),
              },
            ),
          ),
        ],
      ),
    );
  }
}
