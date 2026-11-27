import 'package:equatable/equatable.dart';
import '../../../utils/helpers/date_helper.dart';

enum HomeworkStatus { pending, submitted, reviewed, overdue }

extension HomeworkStatusX on HomeworkStatus {
  String get label => switch (this) {
    HomeworkStatus.pending => 'Pending',
    HomeworkStatus.submitted => 'Submitted',
    HomeworkStatus.reviewed => 'Reviewed',
    HomeworkStatus.overdue => 'Overdue',
  };
}

/// A file the parent handed in (stored in Firebase Storage).
class HandinFile extends Equatable {
  const HandinFile({
    required this.name,
    this.url = '',
    this.path = '',
    this.type = '',
    this.size = 0,
  });
  final String name, url, path, type;
  final int size;

  bool get isImage => type.startsWith('image/');

  factory HandinFile.fromJson(Map<String, dynamic> j) => HandinFile(
    name: '${j['name'] ?? ''}',
    url: '${j['url'] ?? ''}',
    path: '${j['path'] ?? ''}',
    type: '${j['type'] ?? ''}',
    size: (j['size'] as num?)?.toInt() ?? 0,
  );

  Map<String, dynamic> toJson() => {
    'name': name,
    'url': url,
    'path': path,
    'type': type,
    'size': size,
  };

  /// "1.2 MB" / "340 KB".
  String get sizeLabel => size >= 1024 * 1024
      ? '${(size / 1024 / 1024).toStringAsFixed(1)} MB'
      : '${(size / 1024).ceil()} KB';

  @override
  List<Object?> get props => [name, url, path, type, size];
}

/// A file picked on the phone, waiting to be uploaded ([bytes] or a local [path]).
class PickedHandin extends Equatable {
  const PickedHandin({
    required this.name,
    required this.mime,
    required this.size,
    this.bytes,
    this.path,
  });
  final String name, mime;
  final int size;
  final List<int>? bytes;
  final String? path;

  static const maxBytes = 15 * 1024 * 1024;
  static const maxFiles = 10;

  /// MIME type of [name] for the allowed kinds (photos and PDF), else null.
  static String? mimeOf(String name) {
    final n = name.toLowerCase();
    if (n.endsWith('.pdf')) return 'application/pdf';
    if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.heic') || n.endsWith('.heif')) return 'image/heic';
    if (n.endsWith('.webp')) return 'image/webp';
    return null;
  }

  @override
  List<Object?> get props => [name, mime, size, path, bytes?.length];
}

class Homework extends Equatable {
  const Homework({
    required this.id,
    required this.subject,
    required this.title,
    required this.description,
    required this.assignedOn,
    required this.due,
    required this.teacher,
    this.submitted = false,
    this.reviewed = false,
    this.attachments = const [],
    this.remark,
    this.score,
    this.studentId = '',
    this.open = true,
    this.maxMarks,
    this.files = const [],
    this.note = '',
    this.submittedAt,
    this.late = false,
  });
  final String id, subject, title, description, teacher;
  final DateTime assignedOn, due;
  final bool submitted, reviewed;
  final List<String> attachments;
  final String? remark, score;

  /// The child this copy belongs to.
  final String studentId;

  /// The teacher still accepts work (not closed / completed).
  final bool open;
  final num? maxMarks;

  /// What the parent handed in, the note with it, when, and whether after the due date.
  final List<HandinFile> files;
  final String note;
  final DateTime? submittedAt;
  final bool late;

  /// The parent can hand in (or replace the hand-in) while the homework is open and not graded.
  bool get canSubmit => open && !reviewed;

  Homework copyWith({
    bool? submitted,
    List<HandinFile>? files,
    String? note,
    DateTime? submittedAt,
    bool? late,
  }) => Homework(
    id: id,
    subject: subject,
    title: title,
    description: description,
    assignedOn: assignedOn,
    due: due,
    teacher: teacher,
    submitted: submitted ?? this.submitted,
    reviewed: reviewed,
    attachments: attachments,
    remark: remark,
    score: score,
    studentId: studentId,
    open: open,
    maxMarks: maxMarks,
    files: files ?? this.files,
    note: note ?? this.note,
    submittedAt: submittedAt ?? this.submittedAt,
    late: late ?? this.late,
  );

  /// Derived from the clock: not submitted and past due -> overdue.
  HomeworkStatus statusAt(DateTime now) {
    if (reviewed) return HomeworkStatus.reviewed;
    if (submitted) return HomeworkStatus.submitted;
    return dateOnly(due).isBefore(dateOnly(now))
        ? HomeworkStatus.overdue
        : HomeworkStatus.pending;
  }

  @override
  List<Object?> get props => [
    id,
    subject,
    title,
    description,
    teacher,
    assignedOn,
    due,
    submitted,
    reviewed,
    attachments,
    remark,
    score,
    studentId,
    open,
    maxMarks,
    files,
    note,
    submittedAt,
    late,
  ];
}
