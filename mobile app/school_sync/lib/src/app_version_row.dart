import 'skeleton_shimmer.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:package_info_plus/package_info_plus.dart';

abstract class IAppVersionRepository {
  Future<String> installedVersion();
}

class PlatformAppVersionRepository implements IAppVersionRepository {
  @override
  Future<String> installedVersion() async {
    final info = await PackageInfo.fromPlatform();
    return '${info.version} (${info.buildNumber})';
  }
}

class _VersionCubit extends Cubit<String?> {
  _VersionCubit(IAppVersionRepository repo) : super(null) {
    _load(repo);
  }
  Future<void> _load(IAppVersionRepository repo) async {
    try {
      final value = await repo.installedVersion();
      if (!isClosed) emit(value);
    } catch (_) {
      if (!isClosed) emit('Unavailable');
    }
  }
}

class AppVersionRow extends StatelessWidget {
  const AppVersionRow({super.key, this.repository});
  final IAppVersionRepository? repository;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => _VersionCubit(repository ?? PlatformAppVersionRepository()),
    child: BlocBuilder<_VersionCubit, String?>(
      builder: (context, version) => ListTile(
        leading: const Icon(Icons.info_outline_rounded),
        title: const Text('App version'),
        subtitle: version == null
            ? SkeletonShimmer(child: Container(height: 14, width: 100, color: Theme.of(context).colorScheme.surfaceContainerHighest))
            : Text(version),
      ),
    ),
  );
}
