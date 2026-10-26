import 'package:equatable/equatable.dart';
import '../models/leave_models.dart';
import 'load_status.dart';

class LeaveState extends Equatable {
  const LeaveState({this.status = LoadStatus.initial, this.quota = const [], this.applications = const [], this.periods = const [], this.faculty = const []});
  final LoadStatus status;
  final List<LeaveQuota> quota;
  final List<LeaveApplication> applications;
  final List<HandoverPeriod> periods;
  final List<Faculty> faculty;

  LeaveQuota? quotaFor(String code) => quota.where((q) => q.id == code).firstOrNull;

  LeaveState copyWith({LoadStatus? status, List<LeaveQuota>? quota, List<LeaveApplication>? applications, List<HandoverPeriod>? periods, List<Faculty>? faculty}) =>
      LeaveState(
        status: status ?? this.status, quota: quota ?? this.quota, applications: applications ?? this.applications,
        periods: periods ?? this.periods, faculty: faculty ?? this.faculty,
      );

  @override
  List<Object?> get props => [status, quota, applications, periods, faculty];
}
