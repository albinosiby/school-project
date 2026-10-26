import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show errorMessage;
import '../models/auth_models.dart';
import '../repositories/registration_repository_interface.dart';
import 'registration_events.dart';
import 'registration_states.dart';

export 'registration_events.dart';
export 'registration_states.dart';

/// New parent registration: verify one or more students, then submit the guardian's contact details.
class RegistrationBloc extends Bloc<RegistrationEvent, RegistrationState> {
  RegistrationBloc(this._repo) : super(const RegistrationState()) {
    on<StudentLookupRequested>((event, emit) async {
      final no = StudentMatch.normalise(event.admissionNo);
      if (state.students.any((s) => s.admissionNo == no)) {
        emit(
          state.copyWith(
            lookup: LookupStatus.failed,
            lookupError: '$no is already added.',
          ),
        );
        return;
      }
      emit(state.copyWith(lookup: LookupStatus.looking));
      try {
        final match = await _repo.lookupStudent(event.admissionNo, event.dob);
        emit(
          state.copyWith(
            students: [...state.students, match],
            lookup: LookupStatus.idle,
          ),
        );
      } catch (e) {
        emit(
          state.copyWith(
            lookup: LookupStatus.failed,
            lookupError: errorMessage(e),
          ),
        );
      }
    }, transformer: droppable());
    on<StudentRemoved>(
      (event, emit) => emit(
        state.copyWith(
          students: state.students
              .where((s) => s.admissionNo != event.admissionNo)
              .toList(),
        ),
      ),
    );
    on<RegistrationSubmitted>((event, emit) async {
      if (state.students.isEmpty) {
        emit(
          state.copyWith(
            submit: SubmitStatus.failed,
            submitError: 'Verify at least one student first.',
          ),
        );
        return;
      }
      emit(state.copyWith(submit: SubmitStatus.submitting));
      try {
        final result = await _repo.submit(
          RegistrationRequest(
            students: state.students,
            guardianName: event.guardianName.trim(),
            relation: event.relation,
            phone: event.phone.replaceAll(RegExp(r'\D'), ''),
          ),
        );
        emit(state.copyWith(submit: SubmitStatus.submitted, result: result));
      } catch (e) {
        emit(
          state.copyWith(
            submit: SubmitStatus.failed,
            submitError: errorMessage(e),
          ),
        );
      }
    }, transformer: droppable());
  }

  final IRegistrationRepository _repo;
}
