import '../../design_system/design_system.dart';
import '../../modules/transport/cubit/trip_session_cubit.dart';
import '../../modules/transport/models/trip_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import '../cubit/action_cubit.dart';
import '../models/view_model.dart';
import 'design_view.dart';
import '../../config/routes/routes.dart';

class SceneScreen<Controller extends ActionCubit> extends StatefulWidget {
  const SceneScreen({super.key, required this.id});
  final String id;
  @override
  State<SceneScreen<Controller>> createState() =>
      _SceneScreenState<Controller>();
}

class _SceneScreenState<Controller extends ActionCubit>
    extends State<SceneScreen<Controller>> {
  late final Controller cubit;
  @override
  void initState() {
    super.initState();
    cubit = GetIt.I<Controller>()..load(widget.id);
  }

  @override
  void didUpdateWidget(covariant SceneScreen<Controller> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.id != widget.id) cubit.load(widget.id);
  }

  @override
  void dispose() {
    cubit.close();
    super.dispose();
  }

  void _effect(BuildContext context, ViewState state) {
    switch (state.effect) {
      case NavigateTo(:final id):
        final path = AppRoutes.path(id);
        if (AppRoutes.primary.contains(id) ||
            ['7566', '15003', '15282'].contains(id)) {
          context.go(path);
        } else {
          context.push(path);
        }
      case CloseView():
        if (context.canPop()) {
          context.pop();
        } else {
          context.go(AppRoutes.path('5271'));
        }
      case ShowMessage(:final message):
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(message)));
      case null:
        break;
    }
  }

  @override
  Widget build(BuildContext context) => BlocConsumer<Controller, ViewState>(
    bloc: cubit,
    listener: _effect,
    builder: (context, state) {
      if (state.loading) {
        return const Center(child: CircularProgressIndicator());
      }
      if (state.error != null) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: AppSurfaceCard(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(state.error!),
                  const SizedBox(height: 12),
                  AppButton('Retry', onPressed: () => cubit.load(widget.id)),
                ],
              ),
            ),
          ),
        );
      }
      return BlocBuilder<TripSessionCubit, TripSnapshot>(
        bloc: GetIt.I<TripSessionCubit>(),
        builder: (context, trip) => DesignView(
          bindings: GetIt.I<TripSessionCubit>().bindings,
          screen: state.screen!,
          values: state.values,
          selected: state.selected,
          onAction: cubit.act,
          onChanged: cubit.update,
        ),
      );
    },
  );
}
