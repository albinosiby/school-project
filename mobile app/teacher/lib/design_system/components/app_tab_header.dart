import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_avatar.dart';
import 'app_logo.dart';
import '../layouts/adaptive_scaffold.dart' show AppNavScope, kTwoPaneMinWidth, kReadableMaxWidth;

/// Top header of the five tab screens: logo tile (the app logo, or [icon] when given), title, bell (with unread dot) and avatar.
/// Presentational: the data comes from the caller (see modules/home/screens/widgets/teacher_tab_header.dart).
class AppTabHeader extends StatelessWidget {
  const AppTabHeader({super.key, required this.title, this.subtitle, this.eyebrow, this.icon, required this.userName, this.hasUnread = false, this.onBell, this.onAvatar});
  final String title, userName;
  final String? subtitle, eyebrow;
  final IconData? icon;
  final bool hasUnread;
  final VoidCallback? onBell, onAvatar;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.fromLTRB(16.w, 10.h, 16.w, 12.h),
        decoration: const BoxDecoration(color: C.bg, border: Border(bottom: BorderSide(color: C.border))),
        child: Row(children: [
          if (icon == null)
            Container(
              width: 48.r, height: 48.r,
              padding: EdgeInsets.all(4.r),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.panelBorder)),
              child: const AppLogo(size: 40),
            )
          else
            Container(
              width: 48.r, height: 48.r,
              decoration: BoxDecoration(color: C.primaryDark, borderRadius: BorderRadius.circular(R.lg)),
              child: Icon(icon, color: Colors.white, size: 26.r),
            ),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (eyebrow != null) Text(eyebrow!, style: T.caps.copyWith(fontSize: 10.5.sp)),
              Text(title, style: T.h1.copyWith(fontSize: 17.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
              if (subtitle != null) Text(subtitle!, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
          Semantics(
            button: true, label: hasUnread ? 'Notifications, unread' : 'Notifications',
            child: InkResponse(
              onTap: onBell,
              child: Container(
                width: 44.r, height: 44.r,
                decoration: BoxDecoration(color: C.panel, shape: BoxShape.circle, border: Border.all(color: C.panelBorder)),
                child: Stack(alignment: Alignment.center, children: [
                  Icon(Icons.notifications_none_rounded, color: C.primary, size: 24.r),
                  if (hasUnread)
                    Positioned(right: 10.r, top: 10.r, child: Container(width: 9.r, height: 9.r, decoration: BoxDecoration(color: C.danger, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 1.5)))),
                ]),
              ),
            ),
          ),
          SizedBox(width: 10.w),
          Semantics(button: true, label: 'Profile', child: InkResponse(onTap: onAvatar, child: Avatar(userName, size: 44, online: true))),
        ]),
      );
}

/// Scrollable body for tab screens with page padding and room for the dock.
/// Scrolling body of the tab screens. Narrow (phones in portrait): [children] then [side] in one column.
/// Wide (landscape phones, tablets): [children] on the left and [side] in a second column on the right; a screen
/// without [side] is centred at a readable width instead of stretching.
class AppTabBody extends StatelessWidget {
  const AppTabBody({super.key, required this.children, this.side = const [], this.narrow, this.onRefresh, this.sideFlex = 1});
  final List<Widget> children;
  final List<Widget> side;
  /// The single-column order on narrow screens when it is not simply [children] followed by [side].
  final List<Widget>? narrow;
  final Future<void> Function()? onRefresh;
  /// Width share of the side column against the main column (1 = equal).
  final int sideFlex;
  @override
  Widget build(BuildContext context) {
    // the floating dock covers the bottom of the list on phones in portrait only
    final bottom = AppNavScope.hasDock(context) ? 110.h : 24.h;
    final padding = EdgeInsets.fromLTRB(S.page, 16.h, S.page, bottom);
    final list = LayoutBuilder(builder: (context, box) {
      final wide = box.maxWidth >= kTwoPaneMinWidth;
      if (!wide) return ListView(padding: padding, children: narrow ?? [...children, ...side]);
      if (side.isEmpty) {
        return ListView(padding: padding, children: [
          Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: kReadableMaxWidth), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _nodes(children)))),
        ]);
      }
      return ListView(padding: padding, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _nodes(children))),
          SizedBox(width: S.page),
          Expanded(flex: sideFlex, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _nodes(side))),
        ]),
      ]);
    });
    return onRefresh == null ? list : RefreshIndicator(onRefresh: onRefresh!, child: list);
  }

  /// One semantics node per card, as ListView gives each child on narrow screens; otherwise a screen reader
  /// gets the whole two-column page merged into a single node.
  static List<Widget> _nodes(List<Widget> cards) => [for (final c in cards) Semantics(container: true, child: c)];
}
