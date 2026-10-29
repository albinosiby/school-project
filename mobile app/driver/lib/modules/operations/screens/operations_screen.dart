import 'package:flutter/material.dart';
import '../../../core/widgets/scene_screen.dart';
import '../cubit/operations_cubit.dart';

class OperationsScreen extends StatelessWidget {
  const OperationsScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => SceneScreen<OperationsCubit>(id: id);
}
