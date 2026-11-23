String schoolClassLabel({required String grade, required String section, String classId = ''}) {
  final senior = RegExp(r'^cls_(11|12)_(.+)_([A-Z]+)$').firstMatch(classId);
  if (senior != null) {
    final stream = senior
        .group(2)!
        .replaceFirst('course_', '')
        .split('_')
        .map((part) => part.isEmpty ? '' : part[0].toUpperCase() + part.substring(1))
        .join(' ');
    return '${senior.group(1)}-$stream-${senior.group(3)}';
  }
  return section.isEmpty ? grade : '$grade-$section';
}
