import 'package:flutter/material.dart';
import '../../../core/widgets/scene_screen.dart';
import '../cubit/learning_cubit.dart';

class LearningScreen extends StatelessWidget {
  const LearningScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => SceneScreen<LearningCubit>(id: id);
}
