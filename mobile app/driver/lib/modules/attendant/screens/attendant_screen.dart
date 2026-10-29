import 'package:flutter/material.dart';
import '../../../core/widgets/scene_screen.dart';
import '../cubit/attendant_cubit.dart';

class AttendantScreen extends StatelessWidget {
  const AttendantScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => SceneScreen<AttendantCubit>(id: id);
}
