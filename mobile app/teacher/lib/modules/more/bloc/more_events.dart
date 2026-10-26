import 'package:equatable/equatable.dart';

sealed class MoreEvent extends Equatable {
  const MoreEvent();
  @override
  List<Object?> get props => [];
}

class MoreLoadRequested extends MoreEvent {
  const MoreLoadRequested();
}
