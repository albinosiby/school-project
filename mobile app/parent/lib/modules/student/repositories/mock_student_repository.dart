import 'dart:async';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/certificate_models.dart';
import '../models/student_models.dart';
import 'student_demo_data.dart';
import 'student_repository_interface.dart';

class MockStudentRepository implements IStudentRepository {
  MockStudentRepository(this._cache);
  final CacheService _cache;
  final Map<String, List<Certificate>> _certs = {};
  final _changes = StreamController<void>.broadcast();
  int _seq = 0;

  List<Certificate> _certsOf(String childId) =>
      _certs[childId] ??= StudentDemoData.certificates(childId);

  List<Certificate> _sorted(String childId) =>
      [..._certsOf(childId)]..sort((a, b) => b.issuedOn.compareTo(a.issuedOn));

  @override
  Stream<StudentProfile> watchProfile(String childId) => cacheFirst(
    cache: _cache,
    key: 'student:$childId',
    fetch: () async {
      await MockLatency.wait();
      return StudentDemoData.profile(childId);
    },
  );

  @override
  Stream<List<Certificate>> watchCertificates(String childId) => cacheFirst(
    cache: _cache,
    key: 'certificates:$childId',
    fetch: () async {
      await MockLatency.wait();
      return _sorted(childId);
    },
    refetch: () async => _sorted(childId),
    refreshOn: _changes.stream,
  );

  @override
  Future<Certificate> recordDownload({
    required String childId,
    required String certificateId,
  }) async {
    await MockLatency.wait();
    final list = _certsOf(childId);
    final i = list.indexWhere((c) => c.id == certificateId);
    if (i < 0) throw AppException(message: 'Certificate not found.');
    if (list[i].requested)
      throw AppException(message: 'This certificate is still being prepared.');
    final updated = list[i].copyWith(downloadedAt: DateTime.now());
    list[i] = updated;
    _changes.add(null);
    return updated;
  }

  @override
  Future<Certificate> requestCertificate({
    required String childId,
    required CertificateRequestType type,
    required String purpose,
  }) async {
    await MockLatency.wait();
    final pending = _certsOf(
      childId,
    ).any((c) => c.requested && c.title == type.label);
    if (pending)
      throw AppException(
        message:
            'A ${type.label.toLowerCase()} request is already in progress.',
      );
    final c = Certificate(
      id: 'crt_req_${childId}_${++_seq}',
      childId: childId,
      title: type.label,
      category: type.category,
      issuer: 'School Office',
      summary: 'Requested for: ${purpose.trim()}',
      issuedOn: DateTime.now(),
      tags: const ['Requested', 'Ready in 2 working days'],
      size: '-',
      signature: 'Awaiting Principal signature',
      requested: true,
      purpose: purpose.trim(),
    );
    _certsOf(childId).add(c);
    _changes.add(null);
    return c;
  }
}
