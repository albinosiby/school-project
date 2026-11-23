import '../../school/models/school_models.dart';

/// Display only the profile subjects assigned to this teacher in the selected class.
List<String> teachingSubjects(Teacher? teacher, List<SchoolClass> classes, String label) {
  if (teacher == null) return const [];
  final profile = teacher.subjectNames.isNotEmpty
      ? teacher.subjectNames
      : teacher.subjects.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
  final cls = classes.where((c) => c.label == label).firstOrNull;
  if (cls == null) return const [];
  final assigned = cls.subjectNames.isEmpty ? [cls.subject] : cls.subjectNames;
  return profile.where((s) => assigned.any((a) => a.trim().toLowerCase() == s.trim().toLowerCase())).toSet().toList()..sort();
}
