import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../shared/widgets/crew_widgets.dart';
import '../bloc/roster_bloc.dart';
import '../models/student_models.dart';
import 'widgets/student_sheet.dart';

/// Figma 13 Students: the bus roster with search, stop filter, guardian phone and Call.
class StudentsScreen extends StatefulWidget {
  const StudentsScreen({super.key});
  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  String _q = '';
  String _stop = 'All';

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: C.surface,
    body: Column(children: [
      const CrewTabHeader(title: 'Students'),
      Expanded(
        child: CrewContextView(
          builder: (context, ctx) {
            final bus = ctx.bus!;
            return DataView<RosterBloc, List<BusStudent>>(
              create: () => getIt<RosterBloc>(),
              dataKey: bus.id,
              builder: (context, roster) {
                final rows = roster.where((s) =>
                    (_q.isEmpty || '${s.name} ${s.classLabel} ${s.rollLabel} ${s.busStop} ${s.guardian} ${s.phone}'.toLowerCase().contains(_q.toLowerCase())) &&
                    (_stop == 'All' || s.busStop == _stop)).toList();
                final stops = ['All', for (final s in bus.stops) s.name];
                return ListView(
                  padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 110.h),
                  children: [
                    Row(children: [
                      Expanded(child: Text('${roster.length} students on ${bus.label}', style: T.h2)),
                      TextButton.icon(onPressed: () => context.push(RoutePaths.stops), icon: Icon(Icons.place_rounded, size: 18.r), label: const Text('Stops')),
                    ]),
                    SizedBox(height: 10.h),
                    AppSearchField(hint: 'Search student, class, guardian, phone…', onChanged: (v) => setState(() => _q = v)),
                    SizedBox(height: 10.h),
                    FilterChips(items: [for (final s in stops) s == 'All' ? 'All (${roster.length})' : '$s (${roster.where((r) => r.busStop == s).length})'], value: _stop == 'All' ? 'All (${roster.length})' : '$_stop (${roster.where((r) => r.busStop == _stop).length})', onChanged: (v) => setState(() => _stop = v.replaceFirst(RegExp(r' \(\d+\)$'), ''))),
                    SizedBox(height: 12.h),
                    if (roster.isEmpty)
                      const AppEmptyState('No students on this bus', hint: 'The transport office assigns students to buses in the admin console.', icon: Icons.groups_outlined)
                    else if (rows.isEmpty)
                      const AppEmptyState('No students match', icon: Icons.search_off_rounded),
                    for (final s in rows)
                      AppSurfaceCard(
                        margin: EdgeInsets.only(bottom: 10.h),
                        padding: EdgeInsets.all(12.w),
                        onTap: () => showStudentSheet(context, s, bus),
                        semanticLabel: s.name,
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Avatar(s.name, size: 44),
                            SizedBox(width: 12.w),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(s.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                                Text([s.rollLabel, s.classLabel].where((e) => e.isNotEmpty).join(' · '), style: T.small),
                                Row(children: [
                                  Icon(Icons.place_outlined, size: 13.r, color: C.slate),
                                  SizedBox(width: 3.w),
                                  Expanded(child: Text(s.busStop.isEmpty ? 'No stop' : s.busStop, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
                                ]),
                              ]),
                            ),
                            if (s.medicalNote.isNotEmpty) Padding(padding: EdgeInsets.only(left: 6.w), child: Icon(Icons.medical_information_rounded, color: C.danger, size: 20.r)),
                          ]),
                          SizedBox(height: 10.h),
                          Row(children: [
                            Expanded(child: GuardianLine(student: s)),
                            SizedBox(width: 8.w),
                            CallButton(phone: s.phone, name: s.guardian, size: 34),
                          ]),
                        ]),
                      ),
                  ],
                );
              },
            );
          },
        ),
      ),
    ]),
  );
}
