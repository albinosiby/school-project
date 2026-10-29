import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/widgets/scene_screen.dart';
import '../../../config/routes/routes.dart';
import '../cubit/account_cubit.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) {
    final scene = SceneScreen<AccountCubit>(id: id);
    if (id != '6922' && id != '788') return scene;
    return Stack(
      children: [
        scene,
        Positioned(
          top: 50,
          right: 66,
          child: PopupMenuButton<String>(
            tooltip: 'Account options',
            icon: const Icon(Icons.more_vert, size: 20),
            onSelected: (id) => context.push(AppRoutes.path(id)),
            itemBuilder: (context) => [
              if (id == '6922')
                const PopupMenuItem(value: '8924', child: Text('Edit profile')),
              const PopupMenuItem(value: '9182', child: Text('Settings')),
              const PopupMenuItem(
                value: '15003',
                child: Text('Change crew role'),
              ),
              PopupMenuItem(
                value: id == '788' ? '1058' : '9484',
                child: const Text('Digital pass'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
