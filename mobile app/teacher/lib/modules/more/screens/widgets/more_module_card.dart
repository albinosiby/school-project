import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// One tool entry on the More hub.
class MoreModule {
  const MoreModule(this.title, this.sub, this.icon, this.onOpen, {this.badge, this.note, this.cta, this.onCta});
  final String title, sub;
  final IconData icon;
  final VoidCallback onOpen;
  final String? badge, note, cta;
  final VoidCallback? onCta;
}

/// Card for a [MoreModule]: icon tile, title, subtitle, grey badge / blue note, chevron or CTA button.
class MoreModuleCard extends StatelessWidget {
  const MoreModuleCard(this.m, {super.key});
  final MoreModule m;
  @override
  Widget build(BuildContext context) => AppCard(
        onTap: m.onOpen,
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          IconTile(m.icon, size: 44),
          SizedBox(width: 14.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(m.title, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
              SizedBox(height: 2.h),
              Text(m.sub, style: T.body, maxLines: 2, overflow: TextOverflow.ellipsis),
              if (m.badge != null) ...[
                SizedBox(height: 8.h),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(R.sm)),
                  child: Text(m.badge!, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small.copyWith(color: C.slate, fontWeight: FontWeight.w600)),
                ),
              ],
              if (m.note != null) ...[
                SizedBox(height: 8.h),
                Text(m.note!, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small.copyWith(color: C.primary, fontWeight: FontWeight.w600)),
              ],
            ]),
          ),
          SizedBox(width: 8.w),
          if (m.cta != null)
            AppButton(m.cta!, expand: false, small: true, onPressed: m.onCta ?? m.onOpen)
          else
            Padding(padding: EdgeInsets.only(top: 2.h), child: Icon(Icons.chevron_right_rounded, color: C.slate, size: 24.r)),
        ]),
      );
}

/// Small tappable metric of the "Today's Teaching Pulse" panel.
class PulseTile extends StatelessWidget {
  const PulseTile({super.key, required this.icon, required this.label, required this.value, required this.sub, required this.onTap});
  final IconData icon;
  final String label, value, sub;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true, label: '$label: $value, $sub',
        excludeSemantics: true,
        child: AppCard(
          radius: R.lg, padding: EdgeInsets.all(10.r), onTap: onTap,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              IconTile(icon, size: 26),
              SizedBox(width: 6.w),
              Expanded(child: Text(label, style: T.capsMuted.copyWith(fontSize: 9.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
            ]),
            SizedBox(height: 8.h),
            FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(value, style: T.h3)),
            Text(sub, style: T.small.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
          ]),
        ),
      );
}
