import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../tokens/app_tokens.dart';

/// Top bar of onboarding / sign-in steps: round back button + small caps step label (Figma "Onboarding 2/3/4").
/// Back pops, or goes to [fallbackRoute] when there is nothing to pop; [onBack] replaces that behaviour.
/// With [showBack] false only the label is shown.
class AppFlowHeader extends StatelessWidget {
  const AppFlowHeader(
    this.label, {
    super.key,
    this.onBack,
    this.fallbackRoute = '/',
    this.showBack = true,
  });
  final String label;
  final VoidCallback? onBack;
  final String fallbackRoute;
  final bool showBack;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 8.h),
    child: Row(
      children: [
        if (showBack) ...[
          Semantics(
            button: true,
            label: 'Back',
            child: Tooltip(
              message: 'Back',
              child: InkResponse(
                onTap:
                    onBack ??
                    () => context.canPop()
                        ? context.pop()
                        : context.go(fallbackRoute),
                radius: 26.r,
                child: Container(
                  width: 44.r,
                  height: 44.r,
                  decoration: BoxDecoration(
                    color: C.bg,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: C.ink.withValues(alpha: .08),
                        blurRadius: 10,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.arrow_back_rounded,
                    color: C.ink,
                    size: 22.r,
                  ),
                ),
              ),
            ),
          ),
          SizedBox(width: 12.w),
        ],
        Expanded(
          child: Text(
            label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: T.capsMuted.copyWith(fontSize: 12.sp),
          ),
        ),
      ],
    ),
  );
}
