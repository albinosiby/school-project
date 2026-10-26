import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../design_system/design_system.dart';
import '../../modules/family/bloc/family_bloc.dart';
import '../../modules/family/models/family_models.dart';
import '../bloc/child_data_bloc.dart';

/// Scopes a [ChildDataBloc] to the selected child and renders loading / error / empty / data.
/// Switching the child in the header re-creates the BLoC, which shows that child's cached data at once.
class ChildDataView<B extends ChildDataBloc<D>, D> extends StatelessWidget {
  const ChildDataView({
    super.key,
    required this.create,
    required this.builder,
    this.isEmpty,
    this.emptyTitle = 'Nothing here yet',
    this.emptyHint,
    this.emptyIcon = Icons.inbox_outlined,
    this.refreshable = true,
  });

  final B Function() create;

  /// Build the content (usually a ListView) from loaded data.
  final Widget Function(BuildContext context, D data, Child child) builder;
  final bool Function(D data)? isEmpty;
  final String emptyTitle;
  final String? emptyHint;
  final IconData emptyIcon;
  final bool refreshable;

  @override
  Widget build(BuildContext context) => BlocBuilder<FamilyBloc, FamilyState>(
    builder: (context, family) {
      if (family.status == LoadStatus.error)
        return AppErrorWidget(
          message: family.error ?? 'Could not load your family.',
          onRetry: () => context.read<FamilyBloc>().add(const LoadFamily()),
        );
      final child = family.selected;
      if (child == null) {
        return family.status == LoadStatus.loading
            ? const AppLoading()
            : Center(
                child: AppEmptyState(
                  'No children linked',
                  hint: 'Please contact the school office.',
                  icon: Icons.family_restroom_rounded,
                ),
              );
      }
      return BlocProvider<B>(
        key: ValueKey('${B.toString()}:${child.id}'),
        create: (_) => create()..add(LoadChildData(child.id)),
        child: BlocBuilder<B, DataState<D>>(
          builder: (context, state) {
            if (state.hasError)
              return AppErrorWidget(
                message: state.error ?? 'Something went wrong.',
                onRetry: () => context.read<B>().add(LoadChildData(child.id)),
              );
            final data = state.data;
            if (data == null) return const AppLoading();
            if (isEmpty?.call(data) ?? false)
              return Center(
                child: AppEmptyState(
                  emptyTitle,
                  hint: emptyHint,
                  icon: emptyIcon,
                ),
              );
            final content = builder(context, data, child);
            if (!refreshable) return content;
            return RefreshIndicator(
              onRefresh: () async {
                context.read<B>().add(const RefreshChildData());
                await Future<void>.delayed(const Duration(milliseconds: 400));
              },
              child: content,
            );
          },
        ),
      );
    },
  );
}
