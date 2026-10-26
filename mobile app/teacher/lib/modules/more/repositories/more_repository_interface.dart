import '../models/more_models.dart';

/// Read-only summary for the More hub. Reads collections owned by other modules
/// (`ls_plans`, `ts_tests`, `cr_certs`, `tk_tasks`, `ms_messages`) and never writes.
abstract class IMoreRepository {
  Future<MoreSummary> getSummary();
  Stream<void> watch();
}
