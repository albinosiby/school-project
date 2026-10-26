import 'package:equatable/equatable.dart';

sealed class CircularsEvent extends Equatable {
  const CircularsEvent();
  @override
  List<Object?> get props => [];
}

class CircularsLoadRequested extends CircularsEvent {
  const CircularsLoadRequested();
}

class CircularsCategoryChanged extends CircularsEvent {
  const CircularsCategoryChanged(this.category);
  final String category;
  @override
  List<Object?> get props => [category];
}

class CircularsQueryChanged extends CircularsEvent {
  const CircularsQueryChanged(this.query);
  final String query;
  @override
  List<Object?> get props => [query];
}

class CircularsUnreadToggled extends CircularsEvent {
  const CircularsUnreadToggled();
}

class CircularsSortToggled extends CircularsEvent {
  const CircularsSortToggled();
}

class CircularPinToggled extends CircularsEvent {
  const CircularPinToggled(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// The circular was opened (marks it read).
class CircularOpened extends CircularsEvent {
  const CircularOpened(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class CircularAcknowledged extends CircularsEvent {
  const CircularAcknowledged(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}
