import 'package:equatable/equatable.dart';
import 'tasks_format.dart';

/// Task categories shown as sections on the Tasks tab (in order). Reminders use [kReminderCategory].
const kTaskCategories = ['Academic & Grading', 'Lesson Prep', 'Admin & Compliance', 'Student Follow-up'];
const kReminderCategory = 'Reminder';

/// A teacher task or reminder (`tk_tasks`). Unknown keys (lastContact, …) are kept in [extra].
class TaskItem extends Equatable {
  const TaskItem({
    required this.id, required this.title, this.kind = 'task', this.category = 'Academic & Grading', this.priority = 'medium', this.classId = '',
    this.due = '', this.status = 'pending', this.subtitle = '', this.label = '', this.tag = '', this.notes = '', this.homeworkId = '',
    this.reviewed, this.total, this.notify = true, this.doneAt, this.extra = const {},
  });

  final String id, title, kind, category, priority, classId, due, status, subtitle, label, tag, notes, homeworkId;
  final int? reviewed, total;
  final bool notify;
  final String? doneAt;
  final Map<String, dynamic> extra;

  static const _known = {'id', 'title', 'kind', 'category', 'priority', 'classId', 'due', 'status', 'subtitle', 'label', 'tag', 'notes', 'homeworkId', 'reviewed', 'total', 'notify', 'doneAt'};

  bool get isDone => status == 'done';
  bool get isReminder => kind == 'reminder';
  DateTime? get dueAt => parseDt(due);
  bool get hasProgress => total != null && total! > 0;

  /// Open task due today or earlier.
  bool get isDueToday {
    final d = dueAt;
    return d != null && daysFromToday(d) <= 0;
  }

  factory TaskItem.fromJson(Map<String, dynamic> j) => TaskItem(
        id: j['id'] as String? ?? '', title: j['title'] as String? ?? '', kind: j['kind'] as String? ?? 'task',
        category: j['category'] as String? ?? '', priority: j['priority'] as String? ?? 'normal', classId: j['classId'] as String? ?? '',
        due: j['due'] as String? ?? '', status: j['status'] as String? ?? 'pending', subtitle: j['subtitle'] as String? ?? '',
        label: j['label'] as String? ?? '', tag: j['tag'] as String? ?? '', notes: j['notes'] as String? ?? '', homeworkId: j['homeworkId'] as String? ?? '',
        reviewed: (j['reviewed'] as num?)?.toInt(), total: (j['total'] as num?)?.toInt(), notify: j['notify'] != false, doneAt: j['doneAt'] as String?,
        extra: {for (final e in j.entries) if (!_known.contains(e.key)) e.key: e.value},
      );

  Map<String, dynamic> toJson() => {
        ...extra, 'id': id, 'title': title, 'kind': kind, 'category': category, 'priority': priority, 'classId': classId, 'due': due, 'status': status,
        'subtitle': subtitle, 'label': label, 'tag': tag, 'notes': notes, 'homeworkId': homeworkId, 'reviewed': reviewed, 'total': total,
        'notify': notify, 'doneAt': doneAt,
      };

  TaskItem copyWith({String? title, String? kind, String? category, String? priority, String? classId, String? due, bool? notify, String? notes}) => TaskItem(
        id: id, title: title ?? this.title, kind: kind ?? this.kind, category: category ?? this.category, priority: priority ?? this.priority,
        classId: classId ?? this.classId, due: due ?? this.due, status: status, subtitle: subtitle, label: label, tag: tag, notes: notes ?? this.notes,
        homeworkId: homeworkId, reviewed: reviewed, total: total, notify: notify ?? this.notify, doneAt: doneAt, extra: extra,
      );

  @override
  List<Object?> get props => [id, title, kind, category, priority, classId, due, status, subtitle, label, tag, notes, homeworkId, reviewed, total, notify, doneAt, extra];
}
