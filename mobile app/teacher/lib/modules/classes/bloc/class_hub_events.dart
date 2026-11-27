import 'package:equatable/equatable.dart';

sealed class ClassHubEvent extends Equatable {
  const ClassHubEvent();
  @override
  List<Object?> get props => [];
}

class ClassHubLoadRequested extends ClassHubEvent {
  const ClassHubLoadRequested();
}
