import '../../../core/bloc/child_data_bloc.dart';
import '../models/attendance_models.dart';
import '../repositories/attendance_repository_interface.dart';

export 'attendance_events.dart';
export 'attendance_states.dart';

class AttendanceBloc extends ChildDataBloc<AttendanceData> {
  AttendanceBloc(IAttendanceRepository repo) : super(repo.watchAttendance);
}
