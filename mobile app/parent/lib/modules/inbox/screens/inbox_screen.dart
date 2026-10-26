import 'package:flutter/material.dart';
import '../../family/screens/widgets/parent_tab_header.dart';
import '../../messages/screens/threads_list.dart';
import '../../notices/screens/notices_list.dart';
import '../../../design_system/design_system.dart';

/// Inbox tab: notices and teacher messages behind one segmented control.
class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key, this.section});

  /// notices | messages (from the `?section=` query).
  final String? section;

  static const sections = ['Notices', 'Messages'];

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  late String _section =
      _fromQuery(widget.section) ?? InboxScreen.sections.first;

  static String? _fromQuery(String? q) {
    for (final s in InboxScreen.sections) {
      if (s.toLowerCase() == q?.toLowerCase()) return s;
    }
    return null;
  }

  @override
  void didUpdateWidget(InboxScreen old) {
    super.didUpdateWidget(old);
    final q = _fromQuery(widget.section);
    if (q != null && widget.section != old.section) _section = q;
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      const ParentTabHeader(title: 'Inbox'),
      Padding(
        padding: EdgeInsets.fromLTRB(S.page, 10.h, S.page, 0),
        child: AppSegmented(
          items: InboxScreen.sections,
          value: _section,
          track: true,
          onChanged: (v) => setState(() => _section = v),
        ),
      ),
      Expanded(
        child: _section == 'Messages'
            ? const ThreadsList()
            : const NoticesList(),
      ),
    ],
  );
}
