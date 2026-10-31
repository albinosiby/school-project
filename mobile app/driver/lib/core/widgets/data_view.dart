import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../design_system/design_system.dart';
import '../bloc/data_bloc.dart';

/// Creates a [DataBloc] for [dataKey] and renders loading / error / empty / data.
class DataView<B extends DataBloc<D>, D> extends StatelessWidget {
  const DataView({
    super.key,
    required this.create,
    required this.builder,
    this.dataKey = '',
    this.isEmpty,
    this.emptyTitle = 'Nothing here yet',
    this.emptyHint,
    this.emptyIcon = Icons.inbox_outlined,
    this.refreshable = true,
    this.nested = false,
  });
  final B Function() create;
  final String dataKey;
  final Widget Function(BuildContext context, D data) builder;
  final bool Function(D data)? isEmpty;
  final String emptyTitle;
  final String? emptyHint;
  final IconData emptyIcon;
  final bool refreshable;

  /// Rendered inside another scroll view: compact placeholders, no RefreshIndicator.
  final bool nested;

  @override
  Widget build(BuildContext context) => BlocProvider<B>(
    key: ValueKey('$B:$dataKey'),
    create: (_) => create()..add(LoadData(dataKey)),
    child: BlocBuilder<B, DataState<D>>(
      builder: (context, state) {
        if (state.hasError) {
          return AppErrorWidget(message: state.error ?? 'Something went wrong.', onRetry: () => context.read<B>().add(LoadData(dataKey)));
        }
        final data = state.data;
        if (data == null) return AppLoading(rows: nested ? 1 : 4, shrink: nested);
        if (isEmpty?.call(data) ?? false) {
          return Center(child: AppEmptyState(emptyTitle, hint: emptyHint, icon: emptyIcon));
        }
        final content = builder(context, data);
        if (!refreshable || nested) return content;
        return RefreshIndicator(
          onRefresh: () async {
            context.read<B>().add(const RefreshData());
            await Future<void>.delayed(const Duration(milliseconds: 400));
          },
          child: content,
        );
      },
    ),
  );
}
