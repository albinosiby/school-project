import '../../../utils/services/data_store.dart';
import '../models/exam_duty_models.dart';
import 'exam_duty_repository_interface.dart';

class LocalExamDutyRepository implements IExamDutyRepository {
  LocalExamDutyRepository(this._db);
  final DataStore _db;
  static const _c = 'ed_duties', _cand = 'ed_candidates';

  @override
  Future<List<ExamDuty>> getAll() async => [for (final r in _db.list(_c)) ExamDuty.fromJson(r)];

  @override
  Future<ExamDuty?> get(String id) async {
    final r = _db.byId(_c, id);
    return r == null ? null : ExamDuty.fromJson(r);
  }

  @override
  Future<void> setChecklist(String id, List<int> checked) async => _db.update(_c, id, {'checked': checked});

  @override
  Future<void> requestSwap(String id, {required String withWhom, required String reason}) async =>
      _db.update(_c, id, {'swap': 'requested', 'swapWith': withWhom, 'swapReason': reason});

  @override
  Future<void> cancelSwap(String id) async => _db.update(_c, id, {'swap': '', 'swapWith': ''});

  @override
  Future<void> submitFinalList(String id) async => _db.update(_c, id, {'submitted': true});

  @override
  Future<List<Candidate>> getCandidates(String dutyId) async =>
      [for (final r in _db.list(_cand)) if (r['dutyId'] == dutyId) Candidate.fromJson(r)]..sort((a, b) => a.seq.compareTo(b.seq));

  @override
  Future<Candidate?> getCandidate(String id) async {
    final r = _db.byId(_cand, id);
    return r == null ? null : Candidate.fromJson(r);
  }

  @override
  Future<void> markCandidate(String id, {required bool present}) async => _db.update(_cand, id, {'status': present ? 'present' : 'absent'});

  @override
  Future<void> setSupplementary(String id, int count) async {
    final c = await getCandidate(id);
    if (c == null || count < 0) return;
    _db.update(_cand, id, {'supp': count, if (count > c.supp) 'suppCode': 'SUP-${4490 + count}'});
  }

  @override
  Future<void> saveIncidentNote(String id, String note) async => _db.update(_cand, id, {'malpractice': note});

  @override
  Stream<void> watch() => _db.watch({_c, _cand});
}
