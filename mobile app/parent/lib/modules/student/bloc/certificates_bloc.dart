import '../../../core/bloc/child_data_bloc.dart';
import '../models/certificate_models.dart';
import '../repositories/student_repository_interface.dart';

export 'student_events.dart';
export 'student_states.dart';

/// Certificates of the selected child (cache-first; downloads and requests push fresh data).
class CertificatesBloc extends ChildDataBloc<List<Certificate>> {
  CertificatesBloc(IStudentRepository repo) : super(repo.watchCertificates);
}
