import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/staff_certificate.dart';
import '../repositories/staff_certificates_repository.dart';

class StaffCertificatesState extends Equatable {
  const StaffCertificatesState({this.loading = true, this.rows = const [], this.error, this.opening});
  final bool loading;
  final List<StaffCertificate> rows;
  final String? error, opening;
  @override
  List<Object?> get props => [loading, rows, error, opening];
}

class StaffCertificatesCubit extends Cubit<StaffCertificatesState> {
  StaffCertificatesCubit(this.repository) : super(const StaffCertificatesState());
  final IStaffCertificatesRepository repository;
  Future<void> load() async {
    emit(StaffCertificatesState(rows: state.rows));
    try {
      final rows = await repository.load();
      if (!isClosed) emit(StaffCertificatesState(loading: false, rows: rows));
    } catch (e) {
      if (!isClosed) emit(StaffCertificatesState(loading: false, rows: state.rows, error: '$e'));
    }
  }

  Future<void> open(StaffCertificate row) async {
    if (state.opening != null) return;
    emit(StaffCertificatesState(loading: false, rows: state.rows, opening: row.id));
    try {
      await repository.open(row);
      if (!isClosed) emit(StaffCertificatesState(loading: false, rows: state.rows));
    } catch (e) {
      if (!isClosed) emit(StaffCertificatesState(loading: false, rows: state.rows, error: '$e'));
    }
  }
}
