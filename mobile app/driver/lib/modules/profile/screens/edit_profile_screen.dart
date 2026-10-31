import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../crew/bloc/crew_bloc.dart';
import '../../crew/bloc/profile_bloc.dart';
import '../../shared/widgets/crew_widgets.dart';

/// Figma 4.1 Edit Profile: the fields a crew member may change themselves (contract 14.7).
class EditProfileScreen extends StatelessWidget {
  const EditProfileScreen({super.key});

  @override
  Widget build(BuildContext context) => CrewContextView(
    requireBus: false,
    builder: (context, ctx) => BlocProvider<ProfileFormBloc>(
      create: (_) => getIt<ProfileFormBloc>(),
      child: BlocConsumer<ProfileFormBloc, ProfileFormState>(
        listener: (context, s) {
          if (s.error != null) ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(behavior: SnackBarBehavior.floating, backgroundColor: C.danger, content: Text(s.error!)));
          if (s.saved) {
            ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(const SnackBar(behavior: SnackBarBehavior.floating, content: Text('Profile updated')));
            context.canPop() ? context.pop() : context.go(RoutePaths.profile);
          }
        },
        builder: (context, s) => _Form(ctx: ctx, busy: s.busy),
      ),
    ),
  );
}

class _Form extends StatefulWidget {
  const _Form({required this.ctx, required this.busy});
  final CrewContext ctx;
  final bool busy;
  @override
  State<_Form> createState() => _FormState();
}

class _FormState extends State<_Form> {
  late final _phone = TextEditingController(text: widget.ctx.me.phone);
  late final _address = TextEditingController(text: widget.ctx.me.address);
  late final _emName = TextEditingController(text: widget.ctx.me.emergencyName);
  late final _emPhone = TextEditingController(text: widget.ctx.me.emergencyPhone);

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Edit profile',
    fallbackRoute: RoutePaths.profile,
    body: ListView(
      padding: EdgeInsets.all(16.w),
      children: [
        AppSurfaceCard(
          margin: EdgeInsets.only(bottom: 16.h),
          child: Row(children: [
            Avatar(widget.ctx.me.name, size: 48),
            SizedBox(width: 12.w),
            Expanded(child: Text('${widget.ctx.me.name}\nName, role, bus and licence are maintained by the transport office.', style: T.small)),
          ]),
        ),
        AppTextField(label: 'Phone', controller: _phone, keyboard: TextInputType.phone),
        AppTextField(label: 'Address', controller: _address, maxLines: 2),
        AppTextField(label: 'Emergency contact name', controller: _emName),
        AppTextField(label: 'Emergency contact phone', controller: _emPhone, keyboard: TextInputType.phone),
      ],
    ),
    bottom: AppButton('Save changes', icon: Icons.save_rounded, busy: widget.busy, onPressed: () => context.read<ProfileFormBloc>().add(SaveProfile(phone: _phone.text, address: _address.text, emergencyName: _emName.text, emergencyPhone: _emPhone.text))),
  );
}
