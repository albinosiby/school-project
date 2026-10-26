import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../bloc/lessons_notice.dart';

/// Formats an ISO date with an intl [pattern]; returns the input when it does not parse.
String fmtIso(String iso, [String pattern = 'MMM d']) {
  final d = DateTime.tryParse(iso);
  return d == null ? iso : DateFormat(pattern).format(d);
}

/// Shows a lessons BLoC [Notice] and performs its navigation.
void handleNotice(BuildContext context, Notice n) {
  if (n.message.isNotEmpty) AppDialogs.showSnackBar(context, message: n.message);
  switch (n.action) {
    case NoticeAction.none:
      break;
    case NoticeAction.pop:
      if (context.canPop()) context.pop();
    case NoticeAction.popTwice:
      final r = GoRouter.of(context);
      if (r.canPop()) r.pop();
      if (r.canPop()) r.pop();
    case NoticeAction.openPreview:
      context.push(RoutePaths.certificatePreview);
  }
}

/// Section title used on detail and edit pages, with optional trailing caption.
class LessonHeading extends StatelessWidget {
  const LessonHeading(this.text, {super.key, this.trailing, this.icon});
  final String text;
  final String? trailing;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(2.w, 18.h, 2.w, 10.h),
        child: Row(children: [
          if (icon != null) ...[Icon(icon, size: 20.r, color: C.primary), SizedBox(width: 8.w)],
          Expanded(child: Text(text, style: T.h2, maxLines: 2, overflow: TextOverflow.ellipsis)),
          if (trailing != null) ...[SizedBox(width: 8.w), Flexible(child: Text(trailing!, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.end))],
        ]),
      );
}

/// Grey filled action button used on test cards (Preview Paper, Edit Test, Share Link…).
class SoftActionButton extends StatelessWidget {
  const SoftActionButton(this.icon, this.label, this.onTap, {super.key});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 44.h,
        child: FilledButton.icon(
          onPressed: onTap,
          icon: Icon(icon, size: 18.r, color: C.ink),
          label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.bodyStrong.copyWith(fontSize: 13.sp)),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFF1F5F9), foregroundColor: C.ink, elevation: 0, padding: EdgeInsets.symmetric(horizontal: 8.w),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.md)),
          ),
        ),
      );
}

/// Removable row (objective / activity / resource) on the lesson plan editor.
class RemovableItemTile extends StatelessWidget {
  const RemovableItemTile({super.key, required this.title, required this.sub, required this.onDelete});
  final String title, sub;
  final VoidCallback onDelete;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 8.h),
        child: AppCard(
          padding: EdgeInsets.fromLTRB(14.w, 8.h, 4.w, 8.h),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis),
                if (sub.isNotEmpty) Text(sub, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ]),
            ),
            IconButton(tooltip: 'Remove', onPressed: onDelete, icon: Icon(Icons.close_rounded, color: C.slate, size: 22.r)),
          ]),
        ),
      );
}

/// Small bottom-sheet form; each field is (label, 'number' | ''). Returns the values when the first field is non-empty.
Future<List<String>?> promptSheet(BuildContext context, String title, List<(String, String)> fields) {
  final cs = [for (final _ in fields) TextEditingController()];
  String? err;
  return showAppSheet<List<String>>(context, title: title, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => Column(children: [
        for (var i = 0; i < fields.length; i++)
          AppTextField(label: fields[i].$1, controller: cs[i], keyboard: fields[i].$2 == 'number' ? TextInputType.number : null),
        if (err != null) Padding(padding: EdgeInsets.only(bottom: 8.h), child: Text(err!, style: T.small.copyWith(color: C.danger))),
        AppButton('Add', onPressed: () {
          if (cs.first.text.trim().isEmpty) {
            set(() => err = '${fields.first.$1} is required');
            return;
          }
          Navigator.pop(ctx, [for (final c in cs) c.text.trim()]);
        }),
      ])));
}

/// Centered spinner shown while a lessons BLoC loads.
class LessonsLoading extends StatelessWidget {
  const LessonsLoading({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator());
}
