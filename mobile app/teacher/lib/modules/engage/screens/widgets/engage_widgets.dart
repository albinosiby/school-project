import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../../school/models/school_models.dart';
import '../../bloc/engage_notice.dart';

/// Pops the screen, or goes home when it was opened directly.
void engageBack(BuildContext context) => context.canPop() ? context.pop() : context.go(RoutePaths.home);

void showNotice(BuildContext context, String message, {bool error = false}) => AppDialogs.showSnackBar(context, message: message, isError: error);

Future<bool> confirmAction(BuildContext context, {required String title, required String message, String confirm = 'Confirm', bool danger = false}) =>
    AppDialogs.showConfirmDialog(context, title: title, message: message, confirm: confirm, danger: danger);

/// `Class 10–B` label used by the engage forms.
String classLabel(SchoolClass c) => 'Class ${c.grade}–${c.section}';

/// Shows every new [Notice] of [B] as a snackbar and closes the screen when the notice asks for it.
class NoticeListener<B extends StateStreamable<St>, St extends NoticeState> extends StatelessWidget {
  const NoticeListener({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => BlocListener<B, St>(
        listenWhen: (p, c) => c.notice != null && c.notice != p.notice,
        listener: (ctx, s) {
          final n = s.notice!;
          showNotice(ctx, n.message, error: n.error);
          if (n.pop) engageBack(ctx);
        },
        child: child,
      );
}

/// [FilterChips] driven by an index (labels carry counts that change).
class IdxChips extends StatelessWidget {
  const IdxChips({super.key, required this.items, required this.index, required this.onChanged});
  final List<String> items;
  final int index;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) =>
      FilterChips(items: items, value: items[index.clamp(0, items.length - 1)], onChanged: (v) => onChanged(items.indexOf(v)));
}

/// Grey caption above a form control.
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 8.h, top: 4.h),
        child: Row(children: [
          Expanded(child: Text(text, style: T.smallStrong.copyWith(color: C.slate, fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ?trailing,
        ]),
      );
}

/// White form section card with an optional icon + title row.
class FormCard extends StatelessWidget {
  const FormCard({super.key, this.title, this.icon, this.trailing, required this.children});
  final String? title;
  final IconData? icon;
  final Widget? trailing;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 12.h),
        child: AppCard(
          padding: EdgeInsets.all(14.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (title != null)
              Padding(
                padding: EdgeInsets.only(bottom: 12.h),
                child: Row(children: [
                  if (icon != null) ...[Icon(icon, size: 18.r, color: C.primary), SizedBox(width: 8.w)],
                  Expanded(child: Text(title!, style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis)),
                  ?trailing,
                ]),
              ),
            ...children,
          ]),
        ),
      );
}

/// Date + start time pick tiles side by side.
class DateTimeFields extends StatelessWidget {
  const DateTimeFields({super.key, required this.date, required this.time, required this.onDate, required this.onTime, this.year = false});
  final String date, time;
  final ValueChanged<String> onDate, onTime;
  final bool year;
  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(
          child: AppPickTile(
            icon: Icons.calendar_today_outlined, plainIcon: true, caption: 'Date', label: fmtDate(date, year: year), trailing: const SizedBox.shrink(),
            onTap: () async {
              final d = await showDatePicker(
                context: context, initialDate: parseIso(date) ?? DateTime.now(),
                firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 730)),
              );
              if (d != null) onDate(isoOf(d));
            },
          ),
        ),
        SizedBox(width: 10.w),
        Expanded(
          child: AppPickTile(
            icon: Icons.access_time_rounded, plainIcon: true, caption: 'Start Time', label: fmtTime(time), trailing: const SizedBox.shrink(),
            onTap: () async {
              final t = await showTimePicker(context: context, initialTime: parseTime(time));
              if (t != null) onTime(hhmm(t));
            },
          ),
        ),
      ]);
}

/// Organizer row (avatar, name, "Lead Organizer • title") shown in the schedule forms.
class OrganizerRow extends StatelessWidget {
  const OrganizerRow({super.key, required this.teacher});
  final Teacher? teacher;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.all(10.w),
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
        child: Row(children: [
          Avatar(teacher?.name ?? '', size: 36), SizedBox(width: 10.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(teacher?.name ?? '', style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                SizedBox(width: 4.w),
                Icon(Icons.verified_rounded, size: 16.r, color: C.primary),
              ]),
              Text('Lead Organizer • ${teacher?.title ?? ''}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
        ]),
      );
}

/// Bottom sheet asking for a short text; returns null when cancelled.
Future<String?> askText(BuildContext context, {required String title, String? hint, String confirm = 'Save', bool required = false}) {
  final c = TextEditingController();
  String? err;
  return showAppSheet<String>(context, title: title, builder: (ctx) => StatefulBuilder(builder: (ctx, set) {
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AppTextField(label: hint ?? 'Note', controller: c, maxLines: 3, hint: 'Type here...'),
          if (err != null) Padding(padding: EdgeInsets.only(bottom: 8.h), child: Text(err!, style: T.small.copyWith(color: C.danger))),
          Row(children: [
            Expanded(child: AppButton('Cancel', kind: BtnKind.outline, onPressed: () => Navigator.pop(ctx))),
            SizedBox(width: 10.w),
            Expanded(
              child: AppButton(confirm, onPressed: () {
                if (required && c.text.trim().isEmpty) {
                  set(() => err = 'Required');
                  return;
                }
                Navigator.pop(ctx, c.text.trim());
              }),
            ),
          ]),
        ]);
      }));
}

/// Centered loader / not-found / error body for engage screens.
class EngageStatusBody extends StatelessWidget {
  const EngageStatusBody({super.key, required this.status, this.error, this.notFound = 'Not found', this.onRetry});
  final EngageStatus status;
  final String? error, notFound;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => switch (status) {
        EngageStatus.failure => AppErrorWidget(message: error ?? 'Something went wrong', onRetry: onRetry),
        EngageStatus.loaded => Center(child: AppEmptyState(notFound ?? 'Not found', icon: Icons.search_off_rounded)),
        _ => const Center(child: CircularProgressIndicator()),
      };
}
