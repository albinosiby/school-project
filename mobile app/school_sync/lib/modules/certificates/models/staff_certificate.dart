import 'package:equatable/equatable.dart';

class StaffCertificate extends Equatable {
  const StaffCertificate({required this.id, required this.title, required this.number, required this.status, required this.issuedOn});
  final String id, title, number, status, issuedOn;
  bool get downloadable => status == 'Issued';
  @override
  List<Object?> get props => [id, title, number, status, issuedOn];
}
