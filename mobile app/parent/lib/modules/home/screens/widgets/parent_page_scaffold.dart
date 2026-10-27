import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../family/bloc/family_bloc.dart';

/// Scaffold of the pushed home screens (Track Live, Behaviour, Apply Leave, Live classes): Figma header
/// (back, caps title, bell -> notifications, avatar -> profile), grey page and optional sticky bottom bar.
class ParentPageScaffold extends StatelessWidget {
  const ParentPageScaffold({
    super.key,
    required this.title,
    required this.body,
    this.bottom,
    this.fallbackRoute = RoutePaths.home,
  });
  final String title;
  final Widget body;
  final Widget? bottom;
  final String fallbackRoute;

  @override
  Widget build(BuildContext context) {
    final guardian = context.select<FamilyBloc, String>(
      (b) => b.state.guardian?.name ?? 'Parent',
    );
    return Scaffold(
      backgroundColor: C.surface,
      appBar: AppPageHeader(
        title,
        userName: guardian,
        fallbackRoute: fallbackRoute,
        onBell: () => context.push(RoutePaths.notifications),
        onAvatar: () => context.push(RoutePaths.profile),
      ),
      body: body,
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
}
