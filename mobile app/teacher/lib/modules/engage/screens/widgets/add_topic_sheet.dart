import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/meeting_models.dart';
import 'engage_widgets.dart';

/// "Add Topic" popup (Figma 1153:8982): returns the new agenda topic, or null when cancelled.
Future<AgendaTopic?> showAddTopicSheet(BuildContext context) {
  final name = TextEditingController(), obj = TextEditingController(), custom = TextEditingController();
  var mins = 15;
  var customOn = false;
  String? err, resource;
  return showAppSheet<AgendaTopic>(context, title: 'Add Topic', subtitle: 'Add a discussion point to the agenda', builder: (ctx) => StatefulBuilder(builder: (ctx, set) {
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AppTextField(label: 'Topic Name *', controller: name, hint: 'e.g. School Fest'),
          FieldLabel('Duration', trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.schedule_rounded, size: 14.r, color: C.slate), SizedBox(width: 4.w),
            Text(customOn ? '${custom.text.trim().isEmpty ? '–' : custom.text.trim()} mins' : '$mins mins', style: T.small),
          ])),
          AppChoiceChips(
            items: const ['10 mins', '15 mins', '20 mins', '30 mins', 'Custom'], value: customOn ? 'Custom' : '$mins mins', solid: true,
            onChanged: (v) => set(() {
              if (v == 'Custom') {
                customOn = true;
              } else if (v.isNotEmpty) {
                customOn = false;
                mins = int.parse(v.split(' ').first);
              }
            }),
          ),
          if (customOn)
            Padding(
              padding: EdgeInsets.only(top: 10.h),
              child: AppTextField(label: 'Custom minutes', controller: custom, keyboard: TextInputType.number, hint: 'e.g. 25', onChanged: (_) => set(() {})),
            ),
          SizedBox(height: 10.h),
          AppTextField(label: 'Core Concept / Objective (Optional)', controller: obj, hint: 'Factorising trinomials & real roots', maxLines: 2),
          Container(
            padding: EdgeInsets.fromLTRB(12.w, 6.h, 4.w, 6.h),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
            child: Row(children: [
              IconTile(Icons.attach_file_rounded, size: 34, tone: Tone.neutral), SizedBox(width: 10.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Attach Resource', style: T.bodyStrong.copyWith(fontSize: 13.sp)),
                  Text(resource ?? 'PDF, PPTX, or worksheet', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
              TextButton(
                style: TextButton.styleFrom(minimumSize: Size(44.w, 44.h)),
                onPressed: () => set(() => resource = 'Topic_Resource.pdf'),
                child: Text(resource == null ? 'Browse' : 'Replace'),
              ),
            ]),
          ),
          if (err != null) Padding(padding: EdgeInsets.only(top: 8.h), child: Text(err!, style: T.small.copyWith(color: C.danger))),
          SizedBox(height: 16.h),
          Row(children: [
            Expanded(child: AppButton('Cancel', kind: BtnKind.outline, onPressed: () => Navigator.pop(ctx))),
            SizedBox(width: 10.w),
            Expanded(
              child: AppButton('Add Topic', icon: Icons.add_rounded, onPressed: () {
                final m = customOn ? int.tryParse(custom.text.trim()) : mins;
                if (name.text.trim().isEmpty) {
                  set(() => err = 'Topic name is required');
                  return;
                }
                if (m == null || m <= 0 || m > 240) {
                  set(() => err = 'Enter a duration between 1 and 240 minutes');
                  return;
                }
                Navigator.pop(ctx, AgendaTopic(title: name.text.trim(), mins: m, objective: obj.text.trim(), resource: resource));
              }),
            ),
          ]),
        ]);
      }));
}
