import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// One tool entry on the More hub.
class MoreModule {
  const MoreModule(this.title, this.sub, this.icon, this.onOpen, {this.tone = Tone.brand, this.badge, this.badgeTone = Tone.neutral});
  final String title, sub;
  final IconData icon;
  final VoidCallback onOpen;
  /// Colour of the icon tile.
  final Tone tone;
  /// Short live count shown as a pill, e.g. "3 unread"; null hides it.
  final String? badge;
  final Tone badgeTone;
}

/// One row of a [MoreGroup]: coloured icon tile, title, subtitle, optional count pill and a chevron.
class MoreRow extends StatelessWidget {
  const MoreRow(this.m, {super.key});
  final MoreModule m;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: [m.title, m.sub, ?m.badge].join(', '),
        excludeSemantics: true,
        child: InkWell(
          onTap: m.onOpen,
          child: Padding(
            padding: EdgeInsets.fromLTRB(14.w, 12.h, 10.w, 12.h),
            child: Row(
              children: [
                IconTile(m.icon, tone: m.tone, size: 42),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(m.title, style: T.bodyStrong.copyWith(fontSize: 15.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                      SizedBox(height: 2.h),
                      Text(m.sub, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
                if (m.badge != null) ...[SizedBox(width: 8.w), ConstrainedBox(constraints: BoxConstraints(maxWidth: 130.w), child: Pill(m.badge!, tone: m.badgeTone))],
                SizedBox(width: 4.w),
                Icon(Icons.chevron_right_rounded, color: C.muted, size: 22.r),
              ],
            ),
          ),
        ),
      );
}

/// A titled card of [MoreRow]s separated by hairlines.
class MoreGroup extends StatelessWidget {
  const MoreGroup({super.key, required this.title, required this.modules});
  final String title;
  final List<MoreModule> modules;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(4.w, 20.h, 4.w, 8.h),
            child: Text(title.toUpperCase(), style: T.capsMuted),
          ),
          AppCard(
            radius: R.xl,
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < modules.length; i++) ...[
                  if (i > 0) Divider(height: 1, color: C.border, indent: 68.w),
                  MoreRow(modules[i]),
                ],
              ],
            ),
          ),
        ],
      );
}
