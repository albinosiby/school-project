import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/app_config.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../crew/models/crew_models.dart';
import '../../shared/widgets/crew_widgets.dart';
import '../../trips/screens/widgets/trip_card.dart';

/// Figma 4. Profile / 15 Profile: identity card, bus, licence, contact, settings rows, sign out.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: C.surface,
    body: Column(children: [
      const CrewTabHeader(title: 'Profile'),
      Expanded(
        child: CrewContextView(
          requireBus: false,
          builder: (context, ctx) {
            final me = ctx.me;
            final bus = ctx.bus;
            final expiry = me.licenseExpiry == null ? null : DateTime.tryParse(me.licenseExpiry!);
            final licenseSoon = expiry != null && expiry.difference(DateTime.now()).inDays < 30;
            return ListView(
              padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 110.h),
              children: [
                AppSurfaceCard(
                  hero: true, color: C.panel, borderColor: C.panelBorder,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Avatar(me.name, size: 64, tone: me.isDriver ? Tone.brand : Tone.purple),
                      SizedBox(width: 14.w),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(me.name, style: T.h1),
                          Text('${me.role.title}${bus == null ? '' : ' · ${bus.label}'}', style: T.small),
                          SizedBox(height: 6.h),
                          Wrap(spacing: 6.w, runSpacing: 4.h, children: [
                            Pill('ID ${me.empId}', tone: Tone.neutral),
                            Pill(me.status, tone: me.status == 'Active' ? Tone.success : Tone.warning, dot: true),
                          ]),
                        ]),
                      ),
                    ]),
                    SizedBox(height: 12.h),
                    Row(children: [
                      Expanded(child: InfoCell('Bus', bus?.label ?? 'None', icon: Icons.directions_bus_rounded)),
                      SizedBox(width: 8.w),
                      Expanded(child: InfoCell('Route', bus?.routeName ?? '--', icon: Icons.route_rounded)),
                      SizedBox(width: 8.w),
                      Expanded(child: InfoCell('Joined', me.joined == null ? '--' : fmtMonthYear(me.joined!), icon: Icons.badge_rounded)),
                    ]),
                  ]),
                ),
                SizedBox(height: 16.h),
                if (me.isDriver && me.licenseNo != null)
                  AppSurfaceCard(
                    margin: EdgeInsets.only(bottom: 16.h),
                    child: Row(children: [
                      IconTile(Icons.badge_rounded, tone: licenseSoon ? Tone.danger : Tone.success),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Driving licence ${me.licenseNo}', style: T.bodyStrong),
                          Text(expiry == null ? 'Expiry not recorded' : '${licenseSoon ? 'Renew soon · expires' : 'Valid till'} ${fmtTripDate(me.licenseExpiry!)} ${expiry.year}', style: T.small.copyWith(color: licenseSoon ? C.danger : C.slate)),
                        ]),
                      ),
                    ]),
                  ),
                AppSettingsGroup([
                  AppSettingsRow(icon: Icons.phone_rounded, title: 'Phone', subtitle: me.phone.isEmpty ? 'Not set' : me.phone, trailing: Icon(Icons.edit_rounded, size: 18.r, color: C.primary), onTap: () => context.push(RoutePaths.editProfile)),
                  AppSettingsRow(icon: Icons.email_rounded, title: 'Login email', subtitle: me.email),
                  AppSettingsRow(icon: Icons.home_rounded, title: 'Address', subtitle: me.address.isEmpty ? 'Not set' : me.address, onTap: () => context.push(RoutePaths.editProfile)),
                  AppSettingsRow(icon: Icons.emergency_rounded, title: 'Emergency contact', subtitle: me.emergencyName.isEmpty ? 'Not set' : '${me.emergencyName} · ${me.emergencyPhone}', onTap: () => context.push(RoutePaths.editProfile)),
                ]),
                SizedBox(height: 16.h),
                AppSettingsGroup([
                  AppSettingsRow(icon: Icons.fact_check_rounded, title: 'My attendance', subtitle: 'Check-in days and punctuality', onTap: () => context.push(RoutePaths.attendance)),
                  AppSettingsRow(icon: Icons.event_busy_rounded, title: 'Leave requests', subtitle: 'Apply and track leave', onTap: () => context.push(RoutePaths.leave)),
                  AppSettingsRow(icon: Icons.campaign_rounded, title: 'Transport notices', onTap: () => context.push(RoutePaths.notices)),
                  AppSettingsRow(icon: Icons.history_rounded, title: 'Trip history', onTap: () => context.push(RoutePaths.tripHistory)),
                  if (ctx.partner != null) AppSettingsRow(icon: Icons.call_rounded, title: 'Call ${ctx.partner!.name}', subtitle: ctx.partner!.role.title, onTap: () => callNumber(context, ctx.partner!.phone, name: ctx.partner!.name)),
                ]),
                SizedBox(height: 16.h),
                AppButton(
                  'Sign out', icon: Icons.logout_rounded, kind: BtnKind.outline,
                  onPressed: () async {
                    final ok = await AppDialogs.showConfirmDialog(context, title: 'Sign out?', message: 'You will need your email and password to sign in again.', confirm: 'Sign out', danger: true);
                    if (ok && context.mounted) context.read<AuthBloc>().add(const LogoutRequested());
                  },
                ),
                SizedBox(height: 12.h),
                Text('Edvio Driver · ${AppConfig.isFirebase ? 'school server' : 'demo data'} · ${ctx.schoolName}', style: T.small, textAlign: TextAlign.center),
              ],
            );
          },
        ),
      ),
    ]),
  );
}
