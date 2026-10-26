import 'package:equatable/equatable.dart';

sealed class HomeEvent extends Equatable {
  const HomeEvent();
  @override
  List<Object?> get props => [];
}

class HomeLoadRequested extends HomeEvent {
  const HomeLoadRequested();
}

/// Marks a pending action task as done.
class HomeTaskCompleted extends HomeEvent {
  const HomeTaskCompleted(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

