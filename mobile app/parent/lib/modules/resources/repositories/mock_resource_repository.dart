import '../../../utils/services/mock_latency.dart';
import '../models/resource_models.dart';
import 'resource_repository_interface.dart';

/// Demo resources (one of each kind).
class MockResourceRepository implements IResourceRepository {
  MockResourceRepository([List<Map<String, dynamic>>? docs]) : _docs = docs ?? demo();
  final List<Map<String, dynamic>> _docs;

  static List<Map<String, dynamic>> demo() {
    final now = DateTime.now();
    String ago(int d) => now.subtract(Duration(days: d)).toIso8601String();
    return [
      {'id': 'r1', 'kind': 'youtube', 'title': 'Fractions explained', 'subject': 'Maths', 'teacher': 'Ms. Deepa', 'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'visibility': 'parents', 'createdAt': ago(1)},
      {'id': 'r2', 'kind': 'file', 'title': 'Chapter 4 worksheet', 'subject': 'Maths', 'teacher': 'Ms. Deepa', 'url': 'https://example.com/ch4.pdf', 'fileName': 'ch4-worksheet.pdf', 'mime': 'application/pdf', 'sizeBytes': 245760, 'visibility': 'parents', 'pinned': true, 'createdAt': ago(4)},
      {'id': 'r3', 'kind': 'file', 'title': 'Plants and their parts', 'subject': 'EVS', 'teacher': 'Mr. Abdul', 'url': 'https://example.com/plants.pptx', 'fileName': 'plants.pptx', 'mime': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'sizeBytes': 3145728, 'visibility': 'parents', 'createdAt': ago(2)},
      {'id': 'r4', 'kind': 'link', 'title': 'Reading list (Drive)', 'subject': 'English', 'teacher': 'Ms. Clara', 'url': 'https://drive.google.com/drive/folders/demo', 'visibility': 'parents', 'createdAt': ago(6)},
      {'id': 'r5', 'kind': 'file', 'title': 'Teacher notes', 'subject': 'Maths', 'url': 'https://example.com/private.pdf', 'visibility': 'private', 'createdAt': ago(1)},
    ];
  }

  @override
  Stream<List<ClassResource>> watchResources(String childId) async* {
    await MockLatency.wait();
    yield ClassResource.sorted([for (final d in _docs) ?ClassResource.fromDoc('${d['id']}', d)]);
  }
}
