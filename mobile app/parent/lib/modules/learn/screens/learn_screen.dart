import 'package:flutter/material.dart';
import '../../family/screens/widgets/parent_tab_header.dart';
import '../../homework/screens/homework_list.dart';
import '../../marks/screens/marks_list.dart';
import '../../timetable/screens/timetable_view.dart';
import '../../../design_system/design_system.dart';

/// Learn tab: homework, marks and timetable behind one segmented control.
class LearnScreen extends StatefulWidget {
  const LearnScreen({super.key, this.section});

  /// homework | marks | timetable (from the `?section=` query).
  final String? section;

  static const sections = ['Homework', 'Marks', 'Timetable'];

  @override
  State<LearnScreen> createState() => _LearnScreenState();
}

class _LearnScreenState extends State<LearnScreen> {
  late String _section =
      _fromQuery(widget.section) ?? LearnScreen.sections.first;

  static String? _fromQuery(String? q) {
    for (final s in LearnScreen.sections) {
      if (s.toLowerCase() == q?.toLowerCase()) return s;
    }
    return null;
  }

  @override
  void didUpdateWidget(LearnScreen old) {
    super.didUpdateWidget(old);
    final q = _fromQuery(widget.section);
    if (q != null && widget.section != old.section) _section = q;
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      const ParentTabHeader(title: 'Learn'),
      Padding(
        padding: EdgeInsets.fromLTRB(S.page, 10.h, S.page, 0),
        child: AppSegmented(
          items: LearnScreen.sections,
          value: _section,
          track: true,
          onChanged: (v) => setState(() => _section = v),
        ),
      ),
      Expanded(
        child: switch (_section) {
          'Marks' => const MarksList(),
          'Timetable' => const TimetableView(),
          _ => const HomeworkList(),
        },
      ),
    ],
  );
}
