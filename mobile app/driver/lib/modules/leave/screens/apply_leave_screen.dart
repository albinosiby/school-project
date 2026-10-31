import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/firebase/crew_session.dart' show isoDay;
import '../bloc/leave_bloc.dart';
import '../models/leave_models.dart';

/// Figma 1.11 Apply Leave.
class ApplyLeaveScreen extends StatefulWidget {
  const ApplyLeaveScreen({super.key});
  @override
  State<ApplyLeaveScreen> createState() => _ApplyLeaveScreenState();
}

class _ApplyLeaveScreenState extends State<ApplyLeaveScreen> {
  String _type = CrewLeave.types.first;
  DateTime _from = today();
  DateTime _to = today();
  final _reason = TextEditingController();

  Future<void> _pick(bool from) async {
    final d = await showDatePicker(context: context, initialDate: from ? _from : _to, firstDate: today().subtract(const Duration(days: 30)), lastDate: today().add(const Duration(days: 365)));
    if (d == null) return;
    setState(() {
      if (from) {
        _from = d;
        if (_to.isBefore(d)) _to = d;
      } else {
        _to = d.isBefore(_from) ? _from : d;
      }
    });
  }

  @override
  Widget build(BuildContext context) => BlocProvider<LeaveFormBloc>(
    create: (_) => getIt<LeaveFormBloc>(),
    child: BlocConsumer<LeaveFormBloc, LeaveFormState>(
      listener: (context, s) {
        if (s.error != null) ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(behavior: SnackBarBehavior.floating, backgroundColor: C.danger, content: Text(s.error!)));
        if (s.saved != null) {
          ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(const SnackBar(behavior: SnackBarBehavior.floating, content: Text('Leave request sent to the transport office')));
          context.canPop() ? context.pop() : context.go(RoutePaths.leave);
        }
      },
      builder: (context, s) {
        final days = _to.difference(_from).inDays + 1;
        return DetailScaffold(
          title: 'Apply for leave',
          fallbackRoute: RoutePaths.leave,
          body: ListView(
            padding: EdgeInsets.all(16.w),
            children: [
              Text('Leave type', style: T.smallStrong.copyWith(color: C.slate)),
              SizedBox(height: 8.h),
              AppChoiceChips(items: CrewLeave.types, value: _type, onChanged: (v) => setState(() => _type = v)),
              SizedBox(height: 16.h),
              Row(children: [
                Expanded(child: _DateTile('From', _from, () => _pick(true))),
                SizedBox(width: 10.w),
                Expanded(child: _DateTile('To', _to, () => _pick(false))),
              ]),
              SizedBox(height: 8.h),
              Text('$days ${days == 1 ? 'day' : 'days'} (${isoDay(_from)}${days > 1 ? ' to ${isoDay(_to)}' : ''})', style: T.small),
              SizedBox(height: 16.h),
              AppTextField(label: 'Reason', controller: _reason, maxLines: 4, hint: 'Why do you need leave? The office reads this.'),
              AppSurfaceCard(
                color: C.warningSoft, borderColor: C.warningSoft,
                child: Row(children: [
                  Icon(Icons.info_rounded, color: C.warningDark, size: 20.r),
                  SizedBox(width: 10.w),
                  Expanded(child: Text('The transport office arranges a replacement before approving. Apply at least a day ahead when you can.', style: T.small.copyWith(color: C.warningDark))),
                ]),
              ),
            ],
          ),
          bottom: AppButton('Submit request', icon: Icons.send_rounded, busy: s.busy, onPressed: () => context.read<LeaveFormBloc>().add(SubmitLeave(type: _type, from: isoDay(_from), to: isoDay(_to), reason: _reason.text))),
        );
      },
    ),
  );
}

class _DateTile extends StatelessWidget {
  const _DateTile(this.label, this.date, this.onTap);
  final String label;
  final DateTime date;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => AppSurfaceCard(
    onTap: onTap,
    padding: EdgeInsets.all(12.w),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label.toUpperCase(), style: T.capsMuted),
      SizedBox(height: 4.h),
      Row(children: [
        Expanded(child: Text(fmtDate(date), style: T.h3)),
        Icon(Icons.calendar_month_rounded, size: 18.r, color: C.primary),
      ]),
    ]),
  );
}
