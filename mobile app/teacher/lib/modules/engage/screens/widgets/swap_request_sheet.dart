import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../bloc/exam_duties_bloc.dart';
import '../../bloc/exam_duties_events.dart';
import '../../models/exam_duty_models.dart';

const _staff = ['Ms. Anjali Mehta', 'Mr. Rajesh Deshmukh', 'Mr. Ramesh Gupta', 'Ms. Sunita (Science)'];

/// "Request Duty Swap" sheet; on send dispatches [SwapRequested] to the caller's [ExamDutiesBloc].
Future<void> showSwapRequestSheet(BuildContext context, ExamDuty duty) async {
  final bloc = context.read<ExamDutiesBloc>();
  var who = _staff.first;
  final reason = TextEditingController();
  String? err;
  final ok = await showAppSheet<bool>(
    context,
    title: 'Request Duty Swap',
    subtitle: '${duty.subject} • ${fmtDate(duty.date)}',
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        AppDropdown<String>(label: 'Swap with', value: who, items: _staff, onChanged: (v) => set(() => who = v)),
        AppTextField(label: 'Reason', controller: reason, maxLines: 2, hint: 'Why do you need a swap?'),
        if (err != null) Padding(padding: EdgeInsets.only(bottom: 8.h), child: Text(err!, style: T.small.copyWith(color: C.danger))),
        Row(children: [
          Expanded(child: AppButton('Cancel', kind: BtnKind.outline, onPressed: () => Navigator.pop(ctx))),
          SizedBox(width: 10.w),
          Expanded(
            child: AppButton('Send Request', onPressed: () {
              if (reason.text.trim().length < 3) {
                set(() => err = 'Please give a reason');
                return;
              }
              Navigator.pop(ctx, true);
            }),
          ),
        ]),
      ]),
    ),
  );
  if (ok == true) bloc.add(SwapRequested(duty.id, withWhom: who, reason: reason.text.trim()));
}
