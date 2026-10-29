import 'package:flutter/material.dart';
import '../../../core/widgets/scene_screen.dart';
import '../cubit/crew_cubit.dart';

class CrewScreen extends StatelessWidget {
  const CrewScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => SceneScreen<CrewCubit>(id: id);
}
