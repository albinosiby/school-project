import '../models/student_models.dart';

abstract class IStudentRepository {
  /// Cache-first: the students on [busId], in stop order then roll order.
  Stream<List<BusStudent>> watchRoster(String busId);
}
