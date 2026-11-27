import '../models/homework_models.dart';

abstract class IHomeworkRepository {
  /// Cache-first: emits the cached value (if any), then the fresh value.
  Stream<List<Homework>> watchHomework(String childId);

  /// Hands in [files] (1-10 photos / PDFs, 15 MB each) with an optional [note] for [childId]'s homework
  /// [homeworkId]; replaces an earlier hand-in. Throws [AppException] with a message to show on failure.
  Future<void> submit({
    required String childId,
    required String homeworkId,
    required List<PickedHandin> files,
    String note = '',
  });
}

/// Checks the picked files against the hand-in limits; returns the problem to show, or null.
String? handinProblem(List<PickedHandin> files, String note) {
  if (files.isEmpty) return 'Add at least one photo or PDF.';
  if (files.length > PickedHandin.maxFiles) return 'Hand in at most ${PickedHandin.maxFiles} files.';
  for (final f in files) {
    if (PickedHandin.mimeOf(f.name) == null && !f.mime.startsWith('image/') && f.mime != 'application/pdf') {
      return '${f.name}: only photos and PDF files can be handed in.';
    }
    if (f.size > PickedHandin.maxBytes) return '${f.name} is larger than 15 MB.';
    if (f.size <= 0) return '${f.name} is empty.';
  }
  if (note.length > 500) return 'Keep the note under 500 characters.';
  return null;
}

/// Storage-safe file name: characters outside [A-Za-z0-9._-] become `_`, at most 80 characters.
String safeHandinName(String name) {
  final base = name.split(RegExp(r'[\\/]')).last;
  final safe = base.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
  return safe.length <= 80 ? safe : safe.substring(safe.length - 80);
}
