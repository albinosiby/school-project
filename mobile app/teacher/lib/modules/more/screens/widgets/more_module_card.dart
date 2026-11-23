import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// One tool entry on the More hub.
class MoreModule {
  const MoreModule(this.title, this.sub, this.icon, this.onOpen, {this.badge, this.badgeTone = Tone.neutral});
  final String title, sub;
  final IconData icon;
  final VoidCallback onOpen;
  /// Short live count shown as a pill, e.g. "3 unread"; null hides it.
  final String? badge;
  final Tone badgeTone;
}

/// Compact tile for a [MoreModule]: tinted icon, title, one-line subtitle and the optional count pill.
/// Two tiles share a row on phones (see MoreTileGrid).
class MoreTile extends StatelessWidget {
  const MoreTile(this.m, {super.key, this.tone = Tone.brand});
  final MoreModule m;
  final Tone tone;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: [m.title, m.sub, ?m.badge].join(', '),
        excludeSemantics: true,
        child: AppCard(
          radius: R.xl,
          padding: EdgeInsets.all(14.r),
          onTap: m.onOpen,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  IconTile(m.icon, tone: tone, size: 42),
                  const Spacer(),
                  Icon(Icons.arrow_outward_rounded, size: 18.r, color: C.muted),
                ],
              ),
              SizedBox(height: 12.h),
              Text(m.title, style: T.bodyStrong.copyWith(fontSize: 14.5.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
              SizedBox(height: 2.h),
              Text(m.sub, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              if (m.badge != null) ...[
                const Spacer(),
                SizedBox(height: 10.h),
                Pill(m.badge!, tone: m.badgeTone),
              ],
            ],
          ),
        ),
      );
}

/// Two tiles per row with equal heights; an odd last tile keeps half the width.
class MoreTileGrid extends StatelessWidget {
  const MoreTileGrid(this.modules, {super.key, this.tone = Tone.brand});
  final List<MoreModule> modules;
  final Tone tone;
  @override
  Widget build(BuildContext context) => Column(
        children: [
          for (var i = 0; i < modules.length; i += 2)
            Padding(
              padding: EdgeInsets.only(bottom: 10.h),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: MoreTile(modules[i], tone: tone)),
                    SizedBox(width: 10.w),
                    Expanded(child: i + 1 < modules.length ? MoreTile(modules[i + 1], tone: tone) : const SizedBox.shrink()),
                  ],
                ),
              ),
            ),
        ],
      );
}
