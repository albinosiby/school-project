import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/timetable_bloc.dart';
import '../bloc/timetable_events.dart';
import '../models/timetable_models.dart';
import 'widgets/weekly_grid_view.dart';

/// Full-screen weekly grid (Figma 1153:13882 "2.2 Weekly Grid"), route RoutePaths.weeklyGrid.
class WeeklyGridScreen extends StatelessWidget {
  const WeeklyGridScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final now = schoolNow();
    return BlocProvider(
      create: (_) => getIt<TimetableBloc>()..add(const TimetableLoadRequested()),
      child: DetailScaffold(
        title: 'Weekly Timetable',
        subtitle: 'Term 2 • Week ${termWeek(now.at)} • ${dayMonth(now.monday)} – ${dayMonth(now.monday.add(const Duration(days: 5)))}',
        fallbackRoute: RoutePaths.timetable,
        body: ListView(padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 40.h), children: [WeeklyGridView(now: now)]),
      ),
    );
  }
}
