import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/mixins/validation_mixins.dart';
import '../../family/models/family_models.dart';
import '../bloc/profile_bloc.dart';
import '../models/guardian_profile.dart';
import 'widgets/change_photo_sheet.dart';
import 'widgets/guardian_avatar.dart';
import 'widgets/header_actions.dart';

/// Indian mobile number: optional +91 / 0 prefix, then 10 digits starting 6-9. Returns "+91 98765 43210" or null.
String? normalizeIndianMobile(String? v) {
  var d = (v ?? '').replaceAll(RegExp(r'[\s\-()]'), '');
  if (d.startsWith('+91')) {
    d = d.substring(3);
  } else if (d.startsWith('0')) {
    d = d.substring(1);
  }
  if (!RegExp(r'^[6-9]\d{9}$').hasMatch(d)) return null;
  return '+91 ${d.substring(0, 5)} ${d.substring(5)}';
}

/// Figma "6.1 Edit Profile" (+ "6.1.1 Change Profile Picture" sheet).
class EditProfileScreen extends StatelessWidget {
  const EditProfileScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<ProfileBloc>()..add(const LoadProfile()),
    child: BlocBuilder<ProfileBloc, ProfileState>(
      buildWhen: (a, b) => (a.profile == null) != (b.profile == null) || a.status != b.status,
      builder: (context, state) {
        final p = state.profile;
        if (p == null) {
          return DetailScaffold(
            title: 'Edit profile',
            fallbackRoute: RoutePaths.profile,
            body: state.status == LoadStatus.error
                ? AppErrorWidget(
                    message: state.error ?? 'Could not load your profile.',
                    onRetry: () => context.read<ProfileBloc>().add(const LoadProfile()),
                  )
                : const AppLoading(rows: 5),
          );
        }
        return _EditProfileForm(initial: p);
      },
    ),
  );
}

class _EditProfileForm extends StatefulWidget {
  const _EditProfileForm({required this.initial});
  final GuardianProfile initial;
  @override
  State<_EditProfileForm> createState() => _EditProfileFormState();
}

class _EditProfileFormState extends State<_EditProfileForm> with ValidationMixin {
  final _form = GlobalKey<FormState>();
  late final GuardianProfile _p = widget.initial;
  late String _relation = guardianRelations.contains(_p.guardian.relation)
      ? _p.guardian.relation
      : guardianRelations.last;
  late String _emergencyRelation = emergencyRelations.contains(_p.emergencyRelation)
      ? _p.emergencyRelation
      : emergencyRelations.first;
  late final _name = TextEditingController(text: _p.guardian.name);
  late final _phone = TextEditingController(text: _p.guardian.phone);
  late final _email = TextEditingController(text: _p.guardian.email);
  late final _address = TextEditingController(text: _p.address);
  late final _eName = TextEditingController(text: _p.emergencyName);
  late final _ePhone = TextEditingController(text: _p.emergencyPhone);

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _address, _eName, _ePhone]) {
      c.dispose();
    }
    super.dispose();
  }

  GuardianProfile _build() {
    final g = _p.guardian;
    return _p.copyWith(
      guardian: Guardian(
        id: g.id,
        name: _name.text.trim(),
        email: _email.text.trim(),
        phone: normalizeIndianMobile(_phone.text) ?? _phone.text.trim(),
        relation: _relation,
      ),
      address: _address.text.trim(),
      emergencyName: _eName.text.trim(),
      emergencyRelation: _emergencyRelation,
      emergencyPhone: normalizeIndianMobile(_ePhone.text) ?? _ePhone.text.trim(),
    );
  }

  // Photo changes save immediately (sheet), so they never make the form dirty.
  bool get _dirty => _build() != _p;

  String? _validateName(String? v) {
    final r = validateRequired(v, 'Full name');
    if (r != null) return r;
    final t = v!.trim();
    if (t.length < 3) return 'Enter your full name';
    if (!RegExp(r"^[A-Za-z][A-Za-z .'\-]*$").hasMatch(t)) return 'Use letters only';
    return null;
  }

  String? _validatePhone(String? v) {
    if (v == null || v.trim().isEmpty) return 'Mobile number is required';
    return normalizeIndianMobile(v) == null ? 'Enter a valid 10-digit mobile number' : null;
  }

  String? _validateEmergencyPhone(String? v) {
    final r = _validatePhone(v);
    if (r != null) return r;
    return normalizeIndianMobile(v) == normalizeIndianMobile(_phone.text)
        ? 'Use a different number from your own'
        : null;
  }

  String? _validateAddress(String? v) {
    final r = validateRequired(v, 'Address');
    if (r != null) return r;
    return v!.trim().length < 10 ? 'Enter your full address' : null;
  }

  void _save() {
    if (!(_form.currentState?.validate() ?? false)) {
      AppDialogs.showSnackBar(context, message: 'Please fix the highlighted fields', isError: true);
      return;
    }
    if (!_dirty) {
      AppDialogs.showSnackBar(context, message: 'No changes to save');
      return;
    }
    final bloc = context.read<ProfileBloc>();
    final photo = bloc.state.profile?.photoStyle;
    bloc.add(SaveProfile(_build().copyWith(photoStyle: () => photo)));
  }

  Future<void> _cancel() async {
    if (_dirty) {
      final discard = await AppDialogs.showConfirmDialog(
        context,
        title: 'Discard changes?',
        message: 'Your edits to the profile will be lost.',
        confirm: 'Discard',
        danger: true,
      );
      if (!discard || !mounted) return;
    }
    _close();
  }

  void _close() => context.canPop() ? context.pop() : context.go(RoutePaths.profile);

  Future<void> _changePhoto(int? current) async {
    final bloc = context.read<ProfileBloc>();
    final choice = await showChangePhotoSheet(context, name: _name.text, current: current);
    if (choice == null || !mounted) return;
    bloc.add(ChangePhoto(choice.style));
    AppDialogs.showSnackBar(
      context,
      message: choice.style == null ? 'Profile photo removed' : 'Profile photo updated',
    );
  }

  @override
  Widget build(BuildContext context) => BlocListener<ProfileBloc, ProfileState>(
    listenWhen: (a, b) => a.save != b.save,
    listener: (context, s) {
      if (s.save == SaveStatus.saved) {
        AppDialogs.showSnackBar(context, message: 'Profile updated');
        _close();
      } else if (s.save == SaveStatus.failed) {
        AppDialogs.showSnackBar(context, message: s.error ?? 'Could not save your profile.', isError: true);
      }
    },
    child: DetailScaffold(
      title: 'Edit profile',
      fallbackRoute: RoutePaths.profile,
      actions: profileHeaderActions(),
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BlocSelector<ProfileBloc, ProfileState, bool>(
            selector: (s) => s.save == SaveStatus.saving,
            builder: (context, saving) => AppButton(
              'Save profile changes',
              icon: Icons.done_all_rounded,
              busy: saving,
              onPressed: saving ? null : _save,
            ),
          ),
          SizedBox(height: 8.h),
          AppButton('Cancel', kind: BtnKind.outline, onPressed: _cancel),
        ],
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 24.h),
          children: [
            _photoHeader(),
            SizedBox(height: 16.h),
            AppCard(
              radius: R.xl,
              padding: EdgeInsets.all(16.r),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const IconTile(Icons.badge_outlined, size: 40),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Guardian details', style: T.h2),
                            Text(
                              'Official registered institutional record',
                              style: T.small,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      const Pill('Verified', tone: Tone.success, icon: Icons.verified_user_outlined),
                    ],
                  ),
                  SizedBox(height: 16.h),
                  Text('RELATIONSHIP TO STUDENT', style: T.capsMuted),
                  SizedBox(height: 6.h),
                  AppSegmented(
                    track: true,
                    items: guardianRelations,
                    value: _relation,
                    onChanged: (v) => setState(() => _relation = v),
                  ),
                  SizedBox(height: 14.h),
                  AppTextField(
                    key: const ValueKey('edit-name'),
                    label: 'FULL LEGAL NAME',
                    controller: _name,
                    validator: _validateName,
                    keyboard: TextInputType.name,
                  ),
                  AppTextField(
                    key: const ValueKey('edit-phone'),
                    label: 'REGISTERED MOBILE NUMBER',
                    controller: _phone,
                    validator: _validatePhone,
                    keyboard: TextInputType.phone,
                    hint: '+91 98765 43210',
                  ),
                  AppTextField(
                    key: const ValueKey('edit-email'),
                    label: 'OFFICIAL EMAIL ADDRESS',
                    controller: _email,
                    validator: validateEmail,
                    keyboard: TextInputType.emailAddress,
                  ),
                  AppTextField(
                    key: const ValueKey('edit-address'),
                    label: 'RESIDENTIAL ADDRESS',
                    controller: _address,
                    validator: _validateAddress,
                    maxLines: 3,
                  ),
                ],
              ),
            ),
            SizedBox(height: 16.h),
            AppCard(
              radius: R.xl,
              padding: EdgeInsets.all(16.r),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('SECONDARY GUARDIAN / EMERGENCY CONTACT', style: T.capsMuted),
                  SizedBox(height: 12.h),
                  AppTextField(
                    key: const ValueKey('edit-emergency-name'),
                    label: 'NAME',
                    controller: _eName,
                    validator: _validateName,
                  ),
                  AppDropdown<String>(
                    label: 'RELATIONSHIP',
                    value: _emergencyRelation,
                    items: emergencyRelations,
                    onChanged: (v) => setState(() => _emergencyRelation = v),
                  ),
                  AppTextField(
                    key: const ValueKey('edit-emergency-phone'),
                    label: 'MOBILE NUMBER',
                    controller: _ePhone,
                    validator: _validateEmergencyPhone,
                    keyboard: TextInputType.phone,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );

  Widget _photoHeader() => BlocSelector<ProfileBloc, ProfileState, (int?, String)>(
    selector: (s) => (s.profile?.photoStyle, s.profile?.parentId ?? ''),
    builder: (context, v) => Column(
      children: [
        Semantics(
          button: true,
          label: 'Change profile photo',
          child: InkWell(
            key: const ValueKey('edit-photo'),
            customBorder: const CircleBorder(),
            onTap: () => _changePhoto(v.$1),
            child: GuardianAvatar(
              name: _name.text,
              style: v.$1,
              size: 92,
              badge: Container(
                width: 34.r,
                height: 34.r,
                decoration: BoxDecoration(
                  color: C.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
                child: Icon(Icons.photo_camera_outlined, color: Colors.white, size: 18.r),
              ),
            ),
          ),
        ),
        SizedBox(height: 10.h),
        Pill('UID: ${v.$2}', tone: Tone.brand, icon: Icons.verified_rounded),
        SizedBox(height: 6.h),
        Text('Tap to update photo - JPG, PNG max 5MB', style: T.small),
      ],
    ),
  );
}
