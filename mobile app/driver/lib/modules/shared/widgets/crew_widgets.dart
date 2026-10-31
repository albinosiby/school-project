import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/services/link_launcher.dart';
import '../../attendance/models/attendance_models.dart';
import '../../students/models/student_models.dart';
import '../../crew/bloc/crew_bloc.dart';
import '../../trips/models/trip_models.dart';

/// Header of the four tab screens: school, bus, bell (notices) and the crew member's avatar.
class CrewTabHeader extends StatelessWidget {
  const CrewTabHeader({super.key, this.title, this.subtitle});
  final String? title, subtitle;

  @override
  Widget build(BuildContext context) => BlocBuilder<CrewBloc, DataState<CrewContext>>(
    builder: (context, state) {
      final ctx = state.data;
      final bus = ctx?.bus;
      return AppTabHeader(
        title: title ?? (ctx?.schoolName.isNotEmpty == true ? ctx!.schoolName : 'Shift Sync'),
        subtitle: subtitle ?? (bus == null ? ctx?.me.role.title ?? 'Transport crew' : '${bus.label} · ${bus.routeName}'),
        icon: Icons.directions_bus_rounded,
        userName: ctx?.me.name ?? '',
        onBell: () => context.push(RoutePaths.notices),
        onAvatar: () => context.go(RoutePaths.profile),
      );
    },
  );
}

/// The signed-in crew context, or a loading / error / "no bus" placeholder.
class CrewContextView extends StatelessWidget {
  const CrewContextView({super.key, required this.builder, this.requireBus = true});
  final Widget Function(BuildContext context, CrewContext ctx) builder;
  final bool requireBus;

  @override
  Widget build(BuildContext context) => BlocBuilder<CrewBloc, DataState<CrewContext>>(
    builder: (context, state) {
      if (state.hasError) {
        return AppErrorWidget(message: state.error ?? 'Could not load your profile.', onRetry: () => context.read<CrewBloc>().add(const LoadData()));
      }
      final ctx = state.data;
      if (ctx == null) return const AppLoading();
      if (requireBus && ctx.bus == null) {
        return Center(
          child: AppEmptyState('No bus allotted yet', hint: 'The transport office has not put you on a bus. Check back later or call the office.', icon: Icons.no_transfer_rounded),
        );
      }
      return builder(context, ctx);
    },
  );
}

/// Opens the phone dialer for [phone]; falls back to a snack bar with the number.
Future<void> callNumber(BuildContext context, String phone, {String? name}) async {
  final digits = phone.replaceAll(RegExp(r'[^\d+]'), '');
  final ok = digits.length >= 6 && await getIt<LinkLauncher>().open('tel:$digits');
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(
      behavior: SnackBarBehavior.floating,
      content: Text(digits.isEmpty ? 'No phone number on record${name == null ? '' : ' for $name'}.' : 'Call ${name ?? ''} at $phone'),
    ));
  }
}

/// Round phone button (Figma student rows).
class CallButton extends StatelessWidget {
  const CallButton({super.key, required this.phone, this.name, this.size = 40});
  final String phone;
  final String? name;
  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: 'Call ${name ?? 'parent'}',
    child: Material(
      color: C.primarySoft,
      borderRadius: BorderRadius.circular(R.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(R.md),
        onTap: () => callNumber(context, phone, name: name),
        child: SizedBox(width: size.r, height: size.r, child: Icon(Icons.call_rounded, size: 20.r, color: C.primary)),
      ),
    ),
  );
}

Tone tripTone(TripStatus s) => switch (s) {
  TripStatus.scheduled => Tone.neutral,
  TripStatus.active => Tone.success,
  TripStatus.completed => Tone.brand,
};

Tone markTone(MarkStatus? s) => switch (s) {
  MarkStatus.boarded => Tone.success,
  MarkStatus.dropped => Tone.brand,
  MarkStatus.absent => Tone.danger,
  null => Tone.neutral,
};

Tone leaveTone(String status) => switch (status) {
  'Approved' => Tone.success,
  'Rejected' => Tone.danger,
  _ => Tone.warning,
};

String clock(DateTime? d) => d == null ? '--:--' : '${d.hour % 12 == 0 ? 12 : d.hour % 12}:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'AM' : 'PM'}';

/// "06:45" -> "6:45 AM".
String clock24(String? t) {
  if (t == null || t.isEmpty) return '--:--';
  final p = t.split(':');
  final h = int.tryParse(p.first) ?? 0, m = p.length > 1 ? p[1] : '00';
  return '${h % 12 == 0 ? 12 : h % 12}:$m ${h < 12 ? 'AM' : 'PM'}';
}

/// Labelled value in a 2-column info grid.
class InfoCell extends StatelessWidget {
  const InfoCell(this.label, this.value, {super.key, this.icon});
  final String label, value;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(12.w),
    decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          if (icon != null) ...[Icon(icon, size: 14.r, color: C.slate), SizedBox(width: 4.w)],
          // scale the caption down instead of clipping it at large system text sizes
          Expanded(child: Align(alignment: Alignment.centerLeft, child: FittedBox(fit: BoxFit.scaleDown, child: Text(label, style: T.capsMuted, maxLines: 1)))),
        ]),
        SizedBox(height: 6.h),
        Align(alignment: Alignment.centerLeft, child: FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: T.h3, maxLines: 1))),
      ],
    ),
  );
}

/// Section card used on Home: title row + body.
class HomeSection extends StatelessWidget {
  const HomeSection({super.key, required this.title, this.action, this.onAction, required this.child});
  final String title;
  final String? action;
  final VoidCallback? onAction;
  final Widget child;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 16.h),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title, action: action, onAction: onAction),
        SizedBox(height: 10.h),
        child,
      ],
    ),
  );
}

/// Guardian name and relation on one line, the phone number on its own line (it must stay readable at large text sizes).
class GuardianLine extends StatelessWidget {
  const GuardianLine({super.key, required this.student});
  final BusStudent student;
  @override
  Widget build(BuildContext context) {
    final s = student;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(Icons.person_outline_rounded, size: 14.r, color: C.slate),
        SizedBox(width: 4.w),
        Expanded(child: Text(s.guardian.isEmpty ? 'Guardian not recorded' : '${s.guardian}${s.relation.isEmpty ? '' : ' (${s.relation})'}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
      ]),
      if (s.phone.isNotEmpty) Padding(padding: EdgeInsets.only(left: 18.w), child: Text(s.phone, style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
    ]);
  }
}
