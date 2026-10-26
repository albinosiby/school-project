import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import 'engage_colors.dart';

/// Round control button of the lobby and the live class / meeting rooms. [size] is in design pixels.
class RoundBtn extends StatelessWidget {
  const RoundBtn({super.key, required this.icon, required this.label, required this.onTap, this.on = false, this.danger = false, this.light = false, this.badge, this.size = 48});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool on, danger;

  /// White button with a primary icon (lobby preview controls).
  final bool light;
  final String? badge;
  final double size;
  @override
  Widget build(BuildContext context) {
    final s = size.r;
    final bg = danger ? C.danger : (on ? (light ? C.bg : C.primary) : (light ? C.bg.withValues(alpha: .7) : EC.stageTile));
    final fg = light ? C.primary : Colors.white;
    return Semantics(
      button: true, label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: s, height: s,
          child: Stack(clipBehavior: Clip.none, children: [
            Container(
              width: s, height: s, alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, color: bg),
              child: Icon(icon, color: fg, size: s * .45),
            ),
            if (badge != null)
              Positioned(
                right: -4.w, top: -6.h,
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 5.w, vertical: 2.h),
                  decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(R.pill)),
                  child: Text(badge!, style: T.small.copyWith(color: Colors.white, fontSize: 10.sp, fontWeight: FontWeight.w800)),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}

/// Dark participant tile (initials in place of video). [height] is in logical pixels (use .h), [avatarSize] in design pixels.
class StageTile extends StatelessWidget {
  const StageTile({super.key, required this.name, this.sub, this.muted = false, this.speaking = false, this.you = false, this.hand = false, this.height, this.avatarSize = 56});
  final String name;
  final String? sub;
  final bool muted, speaking, you, hand;
  final double? height;
  final double avatarSize;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        decoration: BoxDecoration(color: EC.stageTile, borderRadius: BorderRadius.circular(R.xl), border: speaking ? Border.all(color: C.primary, width: 2) : null),
        child: Stack(children: [
          Center(child: Avatar(name, size: avatarSize)),
          Positioned(
            left: 12.w, bottom: 10.h, right: 40.w,
            child: Text.rich(
              TextSpan(children: [
                TextSpan(text: name, style: T.bodyStrong.copyWith(color: Colors.white, fontSize: 13.sp)),
                if (sub != null) TextSpan(text: '  • $sub', style: T.small.copyWith(color: EC.stageMuted, fontSize: 11.sp)),
              ]),
              maxLines: 1, overflow: TextOverflow.ellipsis,
            ),
          ),
          Positioned(
            right: 10.w, bottom: 10.h,
            child: Icon(muted ? Icons.mic_off_rounded : Icons.mic_rounded, size: 16.r, color: muted ? EC.stageMuted : Colors.white, semanticLabel: muted ? 'Muted' : 'Mic on'),
          ),
          if (speaking)
            Positioned(
              left: 10.w, top: 10.h,
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                decoration: BoxDecoration(color: Colors.black38, borderRadius: BorderRadius.circular(R.pill)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.graphic_eq_rounded, size: 14.r, color: Colors.white), SizedBox(width: 4.w),
                  Text('Speaking', style: T.small.copyWith(color: Colors.white, fontSize: 11.sp)),
                ]),
              ),
            ),
          if (you)
            Positioned(
              right: 8.w, top: 8.h,
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(R.pill)),
                child: Text('You', style: T.small.copyWith(color: Colors.white, fontSize: 11.sp, fontWeight: FontWeight.w700)),
              ),
            ),
          if (hand) Positioned(left: 10.w, top: 10.h, child: Text('✋', style: TextStyle(fontSize: 18.sp))),
        ]),
      );
}

/// Pre-join lobby shared by live classes and meetings (Figma "Join Live Class" / "Start / Join Meet").
/// Mic / camera toggles are local (simulated preview).
class Lobby extends StatefulWidget {
  const Lobby({
    super.key, required this.title, required this.chip, required this.code, required this.heading, required this.startsIn, required this.waiting, required this.hostName,
    required this.hostRole, required this.joinLabel, required this.onJoin, this.extra, this.hostBadge = 'Host',
  });
  final String title, chip, code, heading, startsIn, waiting, hostName, hostRole, joinLabel, hostBadge;
  final VoidCallback onJoin;
  final Widget? extra;
  @override
  State<Lobby> createState() => _LobbyState();
}

class _LobbyState extends State<Lobby> {
  bool mic = true, cam = true;

  Widget _darkPill(String text, {required Widget lead}) => Container(
        padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
        decoration: BoxDecoration(color: const Color(0xCC3A3F45), borderRadius: BorderRadius.circular(R.pill)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [lead, SizedBox(width: 6.w), Text(text, style: T.small.copyWith(color: Colors.white, fontSize: 12.sp))]),
      );

  @override
  Widget build(BuildContext context) => DetailScaffold(
        title: widget.title,
        bottom: AppButton(widget.joinLabel, icon: Icons.video_call_outlined, onPressed: widget.onJoin),
        body: ListView(padding: EdgeInsets.all(S.page), children: [
          AppCard(
            padding: EdgeInsets.all(14.w),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Pill(widget.chip, tone: Tone.brand, dot: true)),
                SizedBox(width: 8.w),
                const Spacer(),
                Flexible(
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                    decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.sm), border: Border.all(color: C.border)),
                    child: Text('# ${widget.code}', maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small.copyWith(fontFamily: 'monospace', fontSize: 11.sp)),
                  ),
                ),
              ]),
              SizedBox(height: 10.h),
              Text(widget.heading, style: T.h2, maxLines: 3, overflow: TextOverflow.ellipsis),
              Divider(height: 20.h, color: C.border),
              Row(children: [
                Icon(Icons.alarm_rounded, size: 16.r, color: C.primary), SizedBox(width: 6.w),
                Flexible(child: Text(widget.startsIn, style: T.small.copyWith(color: C.primary, fontSize: 12.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                const Spacer(),
                Container(width: 6.r, height: 6.r, decoration: const BoxDecoration(color: C.success, shape: BoxShape.circle)), SizedBox(width: 6.w),
                Flexible(child: Text(widget.waiting, style: T.small.copyWith(fontSize: 12.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
            ]),
          ),
          SizedBox(height: 14.h),
          Container(
            height: 260.h,
            decoration: BoxDecoration(
              color: cam ? C.bg : EC.stage, borderRadius: BorderRadius.circular(R.xl), border: Border.all(color: C.border),
              boxShadow: [BoxShadow(color: C.ink.withValues(alpha: .06), blurRadius: 12, offset: const Offset(0, 4))],
            ),
            child: Stack(children: [
              Center(
                child: cam
                    ? Column(mainAxisSize: MainAxisSize.min, children: [
                        Avatar(widget.hostName, size: 88), SizedBox(height: 8.h),
                        Icon(Icons.photo_camera_outlined, color: C.primary, size: 28.r),
                      ])
                    : Icon(Icons.videocam_off_rounded, color: EC.stageMuted, size: 48.r),
              ),
              Positioned(
                left: 12.w, top: 12.h,
                child: _darkPill(cam ? 'HD Camera Active' : 'Camera Off',
                    lead: Container(width: 8.r, height: 8.r, decoration: BoxDecoration(color: cam ? C.success : EC.stageMuted, shape: BoxShape.circle))),
              ),
              Positioned(
                left: 12.w, bottom: 14.h,
                child: _darkPill(mic ? 'Good Audio' : 'Mic Muted', lead: Icon(mic ? Icons.bar_chart_rounded : Icons.mic_off_rounded, size: 16.r, color: mic ? C.success : EC.stageMuted)),
              ),
              Positioned(
                right: 12.w, bottom: 10.h,
                child: Container(
                  padding: EdgeInsets.all(4.r),
                  decoration: BoxDecoration(color: const Color(0xCC3A3F45), borderRadius: BorderRadius.circular(R.pill)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    RoundBtn(icon: mic ? Icons.mic_rounded : Icons.mic_off_rounded, label: mic ? 'Mute microphone' : 'Unmute microphone', on: mic, light: true, size: 44, onTap: () => setState(() => mic = !mic)),
                    SizedBox(width: 8.w),
                    RoundBtn(icon: cam ? Icons.videocam_rounded : Icons.videocam_off_rounded, label: cam ? 'Turn camera off' : 'Turn camera on', on: cam, light: true, size: 44, onTap: () => setState(() => cam = !cam)),
                  ]),
                ),
              ),
            ]),
          ),
          if (widget.extra != null) ...[SizedBox(height: 14.h), widget.extra!],
          SizedBox(height: 14.h),
          AppCard(
            padding: EdgeInsets.all(12.w),
            child: Row(children: [
              Avatar(widget.hostName, size: 44), SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text(widget.hostName, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    SizedBox(width: 4.w), Icon(Icons.verified_rounded, size: 16.r, color: C.primary),
                  ]),
                  Text(widget.hostRole, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
              Pill(widget.hostBadge, tone: Tone.neutral),
            ]),
          ),
          SizedBox(height: 8.h),
        ]),
      );
}
