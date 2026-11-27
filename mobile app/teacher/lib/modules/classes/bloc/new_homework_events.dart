import 'package:equatable/equatable.dart';
import '../../engage/screens/widgets/attachment_sheet.dart' show PickedAttachment;
import '../../tasks/models/homework_models.dart';

sealed class NewHomeworkEvent extends Equatable {
  const NewHomeworkEvent();
  @override
  List<Object?> get props => [];
}

/// Loads existing homework; [editId] opens that homework for editing.
class NewHomeworkLoadRequested extends NewHomeworkEvent {
  const NewHomeworkLoadRequested({this.editId});
  final String? editId;
  @override
  List<Object?> get props => [editId];
}

/// Creates (or, when it has an id, updates) the homework; [files] are uploaded first and attached.
class NewHomeworkSubmitted extends NewHomeworkEvent {
  const NewHomeworkSubmitted(this.homework, {required this.enrolled, this.files = const []});
  final Homework homework;
  final int enrolled;
  final List<PickedAttachment> files;
  @override
  List<Object?> get props => [homework, enrolled, files.length];
}
