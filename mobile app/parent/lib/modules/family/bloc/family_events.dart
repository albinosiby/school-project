import 'package:equatable/equatable.dart';

sealed class FamilyEvent extends Equatable {
  const FamilyEvent();
  @override
  List<Object?> get props => [];
}

class LoadFamily extends FamilyEvent {
  const LoadFamily();
}

/// Child switcher in the header.
class SelectChild extends FamilyEvent {
  const SelectChild(this.childId);
  final String childId;
  @override
  List<Object?> get props => [childId];
}

class ClearFamily extends FamilyEvent {
  const ClearFamily();
}
