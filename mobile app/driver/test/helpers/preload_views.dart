import 'package:driver_app/config/routes/view_catalog.dart';
import 'package:driver_app/core/repositories/view_repository.dart';
import 'package:driver_app/di/injection.dart';
import 'package:driver_app/modules/auth/repositories/auth_view_repository.dart';
import 'package:driver_app/modules/crew/repositories/crew_view_repository.dart';
import 'package:driver_app/modules/transport/repositories/transport_view_repository.dart';
import 'package:driver_app/modules/operations/repositories/operations_view_repository.dart';
import 'package:driver_app/modules/account/repositories/account_view_repository.dart';
import 'package:driver_app/modules/attendant/repositories/attendant_view_repository.dart';
import 'package:driver_app/modules/learning/repositories/learning_view_repository.dart';

/// Resolve bundled fixture IO before the widget-test fake clock begins.
Future<void> preloadViews() async {
  final repositories = <String, ViewRepository>{
    'auth': getIt<AuthViewRepository>(),
    'crew': getIt<CrewViewRepository>(),
    'transport': getIt<TransportViewRepository>(),
    'operations': getIt<OperationsViewRepository>(),
    'account': getIt<AccountViewRepository>(),
    'attendant': getIt<AttendantViewRepository>(),
    'learning': getIt<LearningViewRepository>(),
  };
  for (final entry in viewCatalog.entries) {
    await repositories[entry.value.feature]!.load(entry.key);
  }
}
