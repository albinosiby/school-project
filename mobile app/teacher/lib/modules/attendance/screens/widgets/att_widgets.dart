import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../models/attendance_models.dart';

/// Snackbar shortcut used by every attendance screen.
void toast(BuildContext context, String message) => AppDialogs.showSnackBar(context, message: message);

Tone toneForStatus(String s) => switch (s) {
      'Approved' || 'Present' || 'Acknowledged' || 'Submitted' || 'Completed' || 'Confirmed' => Tone.success,
      'Rejected' || 'Absent' => Tone.danger,
      'Pending' || 'Late' || 'Clarify' || 'Draft' || 'Irregular' => Tone.warning,
      _ => Tone.neutral,
    };

/// Shows a date picker; returns an ISO date key or null.
Future<String?> pickDate(BuildContext context, String? initial, {DateTime? first, DateTime? last}) async {
  final now = todayDate();
  final d = await showDatePicker(
    context: context,
    initialDate: initial == null ? now : DateTime.parse(initial),
    firstDate: first ?? now.subtract(const Duration(days: 400)),
    lastDate: last ?? now.add(const Duration(days: 400)),
  );
  return d == null ? null : dkey(d);
}

void goBack(BuildContext c, [String fallback = RoutePaths.attendanceHistory]) => c.canPop() ? c.pop() : c.go(fallback);

/// Standard scrolling body with the page gutter.
class AttBody extends StatelessWidget {
  const AttBody({super.key, required this.children, this.bottom = 24});
  final List<Widget> children;
  final double bottom;
  @override
  Widget build(BuildContext context) => ListView(padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, bottom.h), children: children);
}

Widget attLoading() => const Center(child: CircularProgressIndicator());

/// Navigation between Mark Attendance, Attendance Trends and Staff Self-Log.
class AttTabs extends StatelessWidget {
  const AttTabs(this.index, {super.key});
  final int index;
  static const _items = [
    ('Mark Attendance', Icons.how_to_reg_rounded, RoutePaths.attendanceMark),
    ('Attendance Trends', Icons.show_chart_rounded, RoutePaths.attendanceTrends),
    ('Staff Self-Log', Icons.badge_outlined, RoutePaths.attendanceSelfLog),
  ];
  @override
  Widget build(BuildContext context) => Container(
        height: 52.h, padding: EdgeInsets.all(4.r),
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg)),
        child: ListView.separated(
          scrollDirection: Axis.horizontal, itemCount: _items.length, separatorBuilder: (_, _) => SizedBox(width: 6.w),
          itemBuilder: (_, i) {
            final on = i == index;
            return Semantics(
              button: true, selected: on, label: _items[i].$1,
              child: InkWell(
                borderRadius: BorderRadius.circular(R.md),
                onTap: on ? null : () => context.pushReplacement(_items[i].$3),
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 14.w), alignment: Alignment.center,
                  decoration: BoxDecoration(color: on ? C.primary : Colors.transparent, borderRadius: BorderRadius.circular(R.md)),
                  child: Row(children: [
                    Icon(_items[i].$2, size: 18.r, color: on ? Colors.white : C.slate), SizedBox(width: 6.w),
                    Text(_items[i].$1, style: T.bodyStrong.copyWith(fontSize: 13.5.sp, color: on ? Colors.white : C.slate)),
                  ]),
                ),
              ),
            );
          },
        ),
      );
}

/// Coloured info/alert banner.
class AttBanner extends StatelessWidget {
  const AttBanner({super.key, required this.icon, required this.text, this.tone = Tone.warning, this.sub, this.trailing, this.onTap});
  final IconData icon;
  final String text;
  final String? sub;
  final Tone tone;
  final Widget? trailing;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return InkWell(
      borderRadius: BorderRadius.circular(R.md), onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
        decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: c.fg.withValues(alpha: .3))),
        child: Row(children: [
          Icon(icon, size: 20.r, color: c.fg), SizedBox(width: 8.w),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text, style: T.smallStrong.copyWith(color: c.fg, fontSize: 13.sp)),
            if (sub != null) Text(sub!, style: T.small.copyWith(color: c.fg)),
          ])),
          ?trailing,
        ]),
      ),
    );
  }
}

/// Small tinted number tile (count + label) used in stat rows.
class AttCountTile extends StatelessWidget {
  const AttCountTile({super.key, required this.value, required this.label, this.tone = Tone.neutral, this.sub, this.start = false});
  final String value, label;
  final String? sub;
  final Tone tone;
  final bool start;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return Container(
      padding: EdgeInsets.symmetric(vertical: 10.h, horizontal: 8.w),
      decoration: BoxDecoration(color: c.bg.withValues(alpha: .7), borderRadius: BorderRadius.circular(R.md), border: Border.all(color: c.fg.withValues(alpha: .2))),
      child: Column(crossAxisAlignment: start ? CrossAxisAlignment.start : CrossAxisAlignment.center, children: [
        if (start) Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small.copyWith(fontSize: 11.sp, color: c.fg, fontWeight: FontWeight.w700)),
        FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: T.stat.copyWith(fontSize: 21.sp, color: tone == Tone.neutral ? C.ink : c.fg))),
        if (!start) Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small.copyWith(fontSize: 11.5.sp, color: c.fg, fontWeight: FontWeight.w700)),
        if (sub != null) Text(sub!, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small.copyWith(fontSize: 10.5.sp)),
      ]),
    );
  }
}

/// Asks for a short text in a sheet; returns null when cancelled.
Future<String?> askReason(BuildContext context, {required String title, required String hint, required String action, bool required = true}) =>
    showAppSheet<String>(context, title: title, builder: (ctx) => _ReasonForm(hint: hint, action: action, required: required));

class _ReasonForm extends StatefulWidget {
  const _ReasonForm({required this.hint, required this.action, required this.required});
  final String hint, action;
  final bool required;
  @override
  State<_ReasonForm> createState() => _ReasonFormState();
}

class _ReasonFormState extends State<_ReasonForm> {
  final c = TextEditingController();
  String? err;
  @override
  void dispose() {
    c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(children: [
        TextField(controller: c, maxLines: 3, decoration: InputDecoration(hintText: widget.hint, errorText: err), onChanged: (_) => setState(() => err = null)),
        SizedBox(height: 12.h),
        AppButton(widget.action, onPressed: () {
          if (widget.required && c.text.trim().length < 3) {
            setState(() => err = 'Please enter a short note');
            return;
          }
          Navigator.pop(context, c.text.trim());
        }),
      ]);
}

/// Caps label used above form fields.
class CapsLabel extends StatelessWidget {
  const CapsLabel(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 6.h),
        child: Row(children: [Expanded(child: Text(text.toUpperCase(), style: T.capsMuted)), ?trailing]),
      );
}
