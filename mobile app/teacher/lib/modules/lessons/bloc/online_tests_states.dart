import 'package:equatable/equatable.dart';
import '../models/online_test_models.dart';
import 'lessons_notice.dart';

enum OnlineTestsStatus { initial, loading, loaded, failure }

class OnlineTestsState extends Equatable {
  const OnlineTestsState({this.status = OnlineTestsStatus.initial, this.tests = const [], this.notice, this.error});
  final OnlineTestsStatus status;
  final List<OnlineTest> tests;
  final Notice? notice;
  final String? error;

  OnlineTest? byId(String id) => tests.where((t) => t.id == id).firstOrNull;
  int countOf(String? status) => status == null ? tests.length : tests.where((t) => t.status == status).length;

  OnlineTestsState copyWith({OnlineTestsStatus? status, List<OnlineTest>? tests, Notice? notice, String? error}) =>
      OnlineTestsState(status: status ?? this.status, tests: tests ?? this.tests, notice: notice ?? this.notice, error: error);

  @override
  List<Object?> get props => [status, tests, notice, error];
}
