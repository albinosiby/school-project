import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../tokens/app_tokens.dart';

/// Header for pushed (detail) screens: back arrow, title/subtitle, actions.
class DetailHeader extends StatelessWidget implements PreferredSizeWidget {
  const DetailHeader(
    this.title, {
    super.key,
    this.subtitle,
    this.actions = const [],
    this.fallbackRoute = '/home',
  });
  final String title;
  final String? subtitle;
  final List<Widget> actions;
  final String fallbackRoute;
  @override
  Size get preferredSize => Size.fromHeight(68.h);
  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: Container(
      height: 68.h,
      padding: EdgeInsets.symmetric(horizontal: 12.w),
      decoration: const BoxDecoration(
        color: C.bg,
        border: Border(bottom: BorderSide(color: C.border)),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            onPressed: () =>
                context.canPop() ? context.pop() : context.go(fallbackRoute),
            icon: Icon(Icons.arrow_back_rounded, color: C.ink, size: 24.r),
          ),
          SizedBox(width: 4.w),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: T.h2,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: T.small,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          ...actions,
        ],
      ),
    ),
  );
}

/// Scaffold for pushed screens with an optional sticky bottom action bar.
class DetailScaffold extends StatelessWidget {
  const DetailScaffold({
    super.key,
    required this.title,
    this.subtitle,
    this.actions = const [],
    required this.body,
    this.bottom,
    this.fab,
    this.fallbackRoute = '/home',
  });
  final String title;
  final String? subtitle;
  final List<Widget> actions;
  final Widget body;
  final Widget? bottom, fab;
  final String fallbackRoute;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: DetailHeader(
      title,
      subtitle: subtitle,
      actions: actions,
      fallbackRoute: fallbackRoute,
    ),
    body: body,
    floatingActionButton: fab,
    bottomNavigationBar: bottom == null
        ? null
        : SafeArea(
            child: Container(
              padding: EdgeInsets.fromLTRB(16.w, 10.h, 16.w, 12.h),
              decoration: const BoxDecoration(
                color: C.bg,
                border: Border(top: BorderSide(color: C.border)),
              ),
              child: bottom,
            ),
          ),
  );
}
