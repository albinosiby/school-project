import 'package:equatable/equatable.dart';
import '../models/classes_models.dart';

sealed class DocumentsEvent extends Equatable {
  const DocumentsEvent();
  @override
  List<Object?> get props => [];
}

class DocumentsLoadRequested extends DocumentsEvent {
  const DocumentsLoadRequested(this.studentId);
  final String studentId;
  @override
  List<Object?> get props => [studentId];
}

class DocumentRequested extends DocumentsEvent {
  const DocumentRequested(this.request);
  final DocumentRequest request;
  @override
  List<Object?> get props => [request];
}

class DocumentRequestReceived extends DocumentsEvent {
  const DocumentRequestReceived(this.request);
  final DocumentRequest request;
  @override
  List<Object?> get props => [request];
}

class DocumentRequestCancelled extends DocumentsEvent {
  const DocumentRequestCancelled(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}
