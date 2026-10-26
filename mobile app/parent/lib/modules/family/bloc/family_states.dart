import 'package:equatable/equatable.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../models/family_models.dart';

class FamilyState extends Equatable {
  const FamilyState({
    this.status = LoadStatus.loading,
    this.family,
    this.selectedId,
    this.error,
  });
  final LoadStatus status;
  final Family? family;
  final String? selectedId;
  final String? error;

  Guardian? get guardian => family?.guardian;
  List<Child> get children => family?.children ?? const [];

  /// The child whose data every screen shows.
  Child? get selected {
    if (children.isEmpty) return null;
    return children.firstWhere(
      (c) => c.id == selectedId,
      orElse: () => children.first,
    );
  }

  @override
  List<Object?> get props => [status, family, selectedId, error];
}
