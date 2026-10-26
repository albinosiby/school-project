import 'package:equatable/equatable.dart';
import '../models/online_test_models.dart';

sealed class OnlineTestsEvent extends Equatable {
  const OnlineTestsEvent();
  @override
  List<Object?> get props => [];
}

class OnlineTestsLoadRequested extends OnlineTestsEvent {
  const OnlineTestsLoadRequested();
}

/// Base for events that act on one test by id.
sealed class OnlineTestAction extends OnlineTestsEvent {
  const OnlineTestAction(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Upcoming -> live.
class OnlineTestStarted extends OnlineTestAction {
  const OnlineTestStarted(super.id);
}

/// Live -> completed with a results summary.
class OnlineTestEnded extends OnlineTestAction {
  const OnlineTestEnded(super.id);
}

/// Copies a completed test as a new draft.
class OnlineTestReused extends OnlineTestAction {
  const OnlineTestReused(super.id);
}

class OnlineTestShared extends OnlineTestAction {
  const OnlineTestShared(super.id);
}

class OnlineTestDeleted extends OnlineTestAction {
  const OnlineTestDeleted(super.id);
}

/// Creates (empty id) or updates [test]. [publish] false saves a draft.
class OnlineTestSaved extends OnlineTestsEvent {
  const OnlineTestSaved(this.test, {required this.publish});
  final OnlineTest test;
  final bool publish;
  @override
  List<Object?> get props => [test, publish];
}
