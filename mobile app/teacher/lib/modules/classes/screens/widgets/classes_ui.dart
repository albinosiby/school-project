import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../design_system/design_system.dart';
import '../../../tasks/models/homework_models.dart';

/// Visual helpers shared by the classes & students screens.

const badgeIcons = <String, (IconData, String)>{
  'trophy': (Icons.emoji_events_rounded, 'Trophy'),
  'sparkle': (Icons.auto_awesome_rounded, 'Sparkle'),
  'idea': (Icons.lightbulb_rounded, 'Idea'),
  'empathy': (Icons.favorite_rounded, 'Empathy'),
  'rocket': (Icons.rocket_launch_rounded, 'Rocket'),
  'crown': (Icons.workspace_premium_rounded, 'Crown'),
  'scholar': (Icons.school_rounded, 'Scholar'),
  'teamwork': (Icons.groups_rounded, 'Teamwork'),
};
const badgeThemes = <String, Tone>{
  'Classic Academic Blue': Tone.brand,
  'Emerald Growth': Tone.success,
  'Sunrise Amber': Tone.warning,
  'Royal Violet': Tone.purple,
};
const praiseCategories = ['Academic Excellence', 'Leadership & Values', 'Diligent Effort', 'Helping Hand'];

IconData badgeIcon(String? k) => (badgeIcons[k] ?? badgeIcons['trophy']!).$1;
Tone badgeTone(String? theme) => badgeThemes[theme] ?? Tone.brand;
Tone kindTone(String k) => k == 'praise' ? Tone.brand : k == 'flag' ? Tone.warning : Tone.neutral;
IconData kindIcon(String k) => k == 'praise' ? Icons.star_rounded : k == 'flag' ? Icons.flag_rounded : Icons.sticky_note_2_outlined;

const subjectVisuals = <(IconData, Tone)>[
  (Icons.functions_rounded, Tone.brand),
  (Icons.science_outlined, Tone.purple),
  (Icons.menu_book_rounded, Tone.success),
  (Icons.public_rounded, Tone.warning),
];

String fmtAgo(String? iso, {DateTime? now}) {
  final d = DateTime.tryParse(iso ?? '');
  if (d == null) return '';
  final n = now ?? DateTime.now();
  final days = DateTime(n.year, n.month, n.day).difference(DateTime(d.year, d.month, d.day)).inDays;
  if (days <= 0) return 'Today, ${DateFormat('h:mm a').format(d)}';
  if (days == 1) return 'Yesterday';
  if (days < 7) return '$days days ago';
  return DateFormat('d MMM yyyy').format(d);
}

String fmtSize(num kb) => kb >= 1024 ? '${(kb / 1024).toStringAsFixed(1)} MB' : '${kb.round()} KB';

/// Due date-time of a homework: `due` (yyyy-MM-dd or ISO) + optional `extra['dueTime']` (HH:mm, default 16:00).
DateTime? homeworkDueAt(Homework h) {
  final d = DateTime.tryParse(h.due);
  if (d == null) return null;
  if (h.due.length > 10) return d;
  final t = '${h.extra['dueTime'] ?? '16:00'}'.split(':');
  return DateTime(d.year, d.month, d.day, int.tryParse(t.first) ?? 16, int.tryParse(t.length > 1 ? t[1] : '0') ?? 0);
}

String fmtDue(Homework h) {
  final d = homeworkDueAt(h);
  if (d == null) return '';
  final n = DateTime.now();
  final days = DateTime(d.year, d.month, d.day).difference(DateTime(n.year, n.month, n.day)).inDays;
  final t = DateFormat('h:mm a').format(d);
  if (days == 0) return 'Due Today, $t';
  if (days == 1) return 'Due Tomorrow, $t';
  if (days < 0) return 'Overdue ${DateFormat('d MMM').format(d)}';
  return 'Due ${DateFormat('d MMM').format(d)}, $t';
}

void showNotice(BuildContext context, String? message) {
  if (message != null && message.isNotEmpty) AppDialogs.showSnackBar(context, message: message);
}

/// Pill-shaped filter tab with an optional count (Behaviour record tabs, resource categories).
class CountTab extends StatelessWidget {
  const CountTab(this.label, {super.key, required this.on, required this.onTap, this.icon, this.count, this.iconColor});
  final String label;
  final bool on;
  final VoidCallback onTap;
  final IconData? icon;
  final String? count;
  final Color? iconColor;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true, selected: on,
        child: InkWell(
          borderRadius: BorderRadius.circular(R.pill),
          onTap: onTap,
          child: Container(
            height: 44.h, padding: EdgeInsets.symmetric(horizontal: 14.w), alignment: Alignment.center,
            decoration: BoxDecoration(color: on ? C.primary : C.bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: on ? C.primary : C.border)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) ...[Icon(icon, size: 16.r, color: on ? Colors.white : (iconColor ?? C.warning)), SizedBox(width: 6.w)],
              Text(label, style: T.bodyStrong.copyWith(color: on ? Colors.white : C.slate, fontSize: 13.5.sp)),
              if (count != null) ...[
                SizedBox(width: 6.w),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 1.h),
                  decoration: BoxDecoration(color: on ? Colors.white.withValues(alpha: .2) : C.primarySoft, borderRadius: BorderRadius.circular(R.pill)),
                  child: Text(count!, style: T.smallStrong.copyWith(color: on ? Colors.white : C.primary, fontSize: 11.sp)),
                ),
              ],
            ]),
          ),
        ),
      );
}

/// Section label in caps (e.g. "ENTRY CLASSIFICATION").
class CapsLabel extends StatelessWidget {
  const CapsLabel(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 8.h),
        child: Row(children: [
          Expanded(child: Text(text.toUpperCase(), style: T.capsMuted, maxLines: 1, overflow: TextOverflow.ellipsis)),
          ?trailing,
        ]),
      );
}

/// Icon-only action with a 44×44 tap target and tooltip/semantics label.
class IconAction extends StatelessWidget {
  const IconAction(this.icon, this.label, this.onTap, {super.key, this.color = C.slate});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: label, onPressed: onTap, icon: Icon(icon, size: 20.r, color: color),
        style: IconButton.styleFrom(minimumSize: Size(44.r, 44.r)),
      );
}
