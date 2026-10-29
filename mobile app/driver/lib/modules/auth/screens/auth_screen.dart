import 'package:flutter/material.dart';
import '../../../core/widgets/scene_screen.dart';
import '../cubit/auth_cubit.dart';

class AuthScreen extends StatelessWidget {
  const AuthScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => SceneScreen<AuthCubit>(id: id);
}
