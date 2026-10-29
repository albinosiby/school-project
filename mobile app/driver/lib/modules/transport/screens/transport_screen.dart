import 'package:flutter/material.dart';
import '../../../core/widgets/scene_screen.dart';
import '../cubit/transport_cubit.dart';

class TransportScreen extends StatelessWidget {
  const TransportScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => SceneScreen<TransportCubit>(id: id);
}
