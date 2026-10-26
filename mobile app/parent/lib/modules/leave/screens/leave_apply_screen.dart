import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../family/bloc/family_bloc.dart';
import '../bloc/leave_apply_bloc.dart';

class LeaveApplyScreen extends StatelessWidget {
  const LeaveApplyScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider<LeaveApplyBloc>(
    create: (_) => getIt<LeaveApplyBloc>(),
    child: const _LeaveForm(),
  );
}

class _LeaveForm extends StatefulWidget {
  const _LeaveForm();

  @override
  State<_LeaveForm> createState() => _LeaveFormState();
}

class _LeaveFormState extends State<_LeaveForm> {
  final _reason = TextEditingController();
  DateTime _from = today();
  DateTime _to = today();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pick(bool from) async {
    final d = await showDatePicker(
      context: context,
      initialDate: from ? _from : _to,
      firstDate: today(),
      lastDate: today().add(const Duration(days: 365)),
    );
    if (d == null) return;
    setState(() {
      if (from) {
        _from = d;
        if (_to.isBefore(d)) _to = d;
      } else {
        _to = d;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final child = context.watch<FamilyBloc>().state.selected;
    return BlocConsumer<LeaveApplyBloc, LeaveApplyState>(
      listener: (context, s) {
        if (s.status == ApplyStatus.success) {
          AppDialogs.showSnackBar(
            context,
            message: 'Leave application sent to the class teacher',
          );
          context.pop();
        }
      },
      builder: (context, s) => DetailScaffold(
        title: 'Apply for leave',
        subtitle: child == null
            ? null
            : '${child.name} - Grade ${child.className}',
        fallbackRoute: RoutePaths.leave,
        body: child == null
            ? Center(
                child: AppEmptyState(
                  'No child selected',
                  icon: Icons.family_restroom_rounded,
                ),
              )
            : ListView(
                padding: EdgeInsets.all(S.page),
                children: [
                  AppPickTile(
                    icon: Icons.event_outlined,
                    caption: 'FROM',
                    label: fmtDate(_from, year: true),
                    onTap: () => _pick(true),
                  ),
                  SizedBox(height: 10.h),
                  AppPickTile(
                    icon: Icons.event_available_outlined,
                    caption: 'TO',
                    label: fmtDate(_to, year: true),
                    onTap: () => _pick(false),
                  ),
                  SizedBox(height: 16.h),
                  AppTextField(
                    label: 'Reason',
                    hint: 'Tell the class teacher why',
                    controller: _reason,
                    maxLines: 4,
                    maxLength: 300,
                  ),
                  if (s.status == ApplyStatus.failure)
                    Padding(
                      padding: EdgeInsets.only(bottom: 12.h),
                      child: Text(
                        s.error ?? 'Could not send.',
                        key: const Key('leave-error'),
                        style: T.small.copyWith(color: C.danger),
                      ),
                    ),
                  AppButton(
                    'Send application',
                    icon: Icons.send_rounded,
                    busy: s.status == ApplyStatus.submitting,
                    onPressed: () {
                      context.read<LeaveApplyBloc>().add(
                        LeaveApplyEvent(
                          childId: child.id,
                          from: _from,
                          to: _to,
                          reason: _reason.text,
                        ),
                      );
                    },
                  ),
                ],
              ),
      ),
    );
  }
}
