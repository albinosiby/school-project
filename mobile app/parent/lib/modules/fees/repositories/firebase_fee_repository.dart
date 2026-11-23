import 'package:school_sync/school_sync.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../models/fee_models.dart';
import 'fee_repository_interface.dart';

/// The child's `fee_invoices` and `fee_payments` (matched on `grn`, §13.2). `paid` is kept current by the admin's fee counter.
/// Parents pay into the school account (`school/school.bank`) and report it as a `fee_claims` doc (§13.8); the office
/// verifies it against the bank statement, which records the payment and issues the receipt.
class FirebaseFeeRepository implements IFeeRepository, IFeeDocumentRepository {
  FirebaseFeeRepository(this._session);
  final ParentSession _session;

  @override
  Stream<FeesData> watchFees(String childId) => switchSchoolStream(
    combineLatest<Object>([_session.col('students').doc(childId).snapshots(), _session.watchUser()]),
    (values) {
      final child = values[0] as DocumentSnapshot<Json>;
      final student = child.data();
      if (student == null) throw AppException(message: 'The student record is unavailable.');
      _session.remember(childId, student);
      final grn = '${student['grn'] ?? ''}';
      if (grn.isEmpty) return Stream.value(const FeesData([]));
      final invoices = _session.col('fee_invoices').where('grn', isEqualTo: grn).snapshots();
      final payments = _session.col('fee_payments').where('grn', isEqualTo: grn).snapshots();
      final claims = _session.col('fee_claims').where('studentId', isEqualTo: childId).snapshots();
      final school = _session.col('school').doc('school').snapshots();
      return combineLatest<Object>([invoices, payments, claims, school, _session.watchPolicy()]).asyncMap((all) async {
        final summary = await _session.mobile.call('getMobileStudentFees', {'studentId': childId});
        final ids = Set<String>.from(summary['invoiceIds'] as List? ?? const []);
        final list = [
          for (final d in (all[0] as QuerySnapshot<Json>).docs)
            if (ids.contains(d.id)) fromDoc(d.id, {...d.data(), 'studentId': childId}),
        ]..sort((a, b) => b.due.compareTo(a.due));
        final titles = {for (final i in list) i.id: i.title};
        final receipts = [
          for (final d in (all[1] as QuerySnapshot<Json>).docs)
            if (ids.contains(d.data()['invoiceId'])) receiptOf(d.id, {...d.data(), 'studentId': childId}),
        ]..sort((a, b) => b.date.compareTo(a.date));
        final reported = [for (final d in (all[2] as QuerySnapshot<Json>).docs) claimOf(d.id, d.data(), titles)]
          ..sort((a, b) => b.submittedAt.compareTo(a.submittedAt));
        final bank = bankOf((all[3] as DocumentSnapshot<Json>).data()?['bank']);
        return FeesData(list, receipts: receipts, claims: reported, bank: bank.isEmpty ? null : bank, annual: AnnualFees.fromJson(summary));
      });
    },
  );

  /// There is no payment gateway: parents pay into the school account and report it ([reportPayment]).
  @override
  Future<FeeReceipt> pay({required String childId, required List<String> invoiceIds, required PaymentMethod method}) async =>
      throw AppException(message: 'Pay into the school account shown under Pay Now, then enter the payment details.');

  @override
  Future<PaymentClaim> reportPayment({
    required String childId,
    required String invoiceId,
    required double amount,
    required TransferMode mode,
    required String reference,
    required DateTime paidOn,
    String note = '',
  }) async {
    final ref = reference.trim().toUpperCase();
    if (amount <= 0) throw AppException(message: 'Enter the amount you paid.');
    if (ref.length < 4) throw AppException(message: 'Enter the ${mode.referenceLabel}.');
    final inv = (await _session.col('fee_invoices').doc(invoiceId).get()).data();
    if (inv == null) throw AppException(message: 'This instalment was not found.');
    final claims = _session.col('fee_claims');
    final dup = await claims.where('studentId', isEqualTo: childId).where('reference', isEqualTo: ref).get();
    if (dup.docs.any((d) => d.data()['status'] != 'Rejected')) {
      throw AppException(message: 'This reference was already reported. The office is checking it.');
    }
    final child = await _session.student(childId);
    final now = nowUtc();
    final data = <String, dynamic>{
      'studentId': childId,
      'grn': '${child['grn'] ?? ''}',
      'studentName': '${child['name'] ?? ''}',
      'classId': '${child['classId'] ?? ''}',
      'invoiceId': invoiceId,
      'invoiceNo': '${inv['no'] ?? ''}',
      'amount': amount,
      'mode': mode.label,
      'reference': ref,
      'paidOn': isoDay(paidOn),
      'note': note.trim(),
      'status': 'Pending',
      'parentUid': _session.uid,
      'parentName': '${_session.user['name'] ?? _session.user['email'] ?? ''}',
      'submittedAt': now,
      'updatedAt': now,
      'updatedBy': _session.uid,
    };
    final doc = await claims.add(data);
    return claimOf(doc.id, data, {invoiceId: fromDoc(invoiceId, inv).title});
  }

  @override
  Future<String> downloadReceipt(FeeReceipt receipt) => _openDocument(receipt.studentId, 'receipt', receipt.id, receipt.fileName);

  @override
  Future<String> downloadInvoice(Invoice invoice) => _openDocument(invoice.studentId, 'invoice', invoice.id, 'Invoice_${invoice.id}.pdf');

  Future<String> _openDocument(String studentId, String kind, String id, String name) async {
    final url = await _session.mobile.documentLink(studentId: studentId, kind: kind, documentId: id);
    if (!await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication))
      throw AppException(message: 'Could not open the PDF. Please try again.');
    return name;
  }

  static BankDetails bankOf(Object? v) {
    final b = v is Map ? v : const {};
    String f(String k) => '${b[k] ?? ''}'.trim();
    return BankDetails(
      accountName: f('accountName'),
      accountNo: f('accountNo'),
      ifsc: f('ifsc'),
      bank: f('bank'),
      branch: f('branch'),
      upiId: f('upiId'),
      note: f('note'),
    );
  }

  static PaymentClaim claimOf(String id, Json d, Map<String, String> titles) {
    final mode = TransferMode.values.where((m) => m.label == d['mode']).firstOrNull ?? TransferMode.bankTransfer;
    final status = switch ('${d['status'] ?? ''}') {
      'Verified' => ClaimStatus.verified,
      'Rejected' => ClaimStatus.rejected,
      _ => ClaimStatus.pending,
    };
    String? opt(Object? v) => '${v ?? ''}'.trim().isEmpty ? null : '$v'.trim();
    return PaymentClaim(
      id: id,
      invoiceId: '${d['invoiceId'] ?? ''}',
      invoiceTitle: titles['${d['invoiceId'] ?? ''}'] ?? opt(d['invoiceNo']) ?? 'Fees',
      amount: (d['amount'] as num?)?.toDouble() ?? 0,
      mode: mode,
      reference: '${d['reference'] ?? ''}',
      paidOn: parseDay(d['paidOn']) ?? DateTime.now(),
      submittedAt: parseTime(d['submittedAt']) ?? DateTime.now(),
      status: status,
      note: opt(d['note']),
      reason: opt(d['rejectReason']),
      receiptNo: opt(d['receiptNo']),
    );
  }

  static FeeReceipt receiptOf(String id, Json d) {
    final mode = '${d['mode'] ?? ''}'.toLowerCase();
    return FeeReceipt(
      id: id,
      number: '${d['receiptNo'] ?? id}',
      studentId: '${d['studentId'] ?? ''}',
      date: parseDay(d['date']) ?? DateTime.now(),
      method: PaymentMethod.fromMode(mode),
      lines: [
        FeeItem(
          '${d['invoiceNo'] ?? 'Fees'}${'${d['mode'] ?? ''}'.isEmpty ? '' : ' · ${d['mode']}'}',
          (d['amount'] as num?)?.toDouble() ?? 0,
        ),
      ],
      reference: '${d['invoiceNo'] ?? ''}'.isEmpty ? null : '${d['invoiceNo']}',
    );
  }

  static Invoice fromDoc(String id, Json d) {
    final lines = [
      for (final l in (d['lines'] as List?) ?? const [])
        if (l is Map) FeeItem('${l['label'] ?? ''}', (l['amount'] as num?)?.toDouble() ?? 0),
    ];
    final amount = (d['amount'] as num?)?.toDouble() ?? 0;
    final paid = (d['paid'] as num?)?.toDouble() ?? 0;
    final override = d['statusOverride'];
    InvoiceStatus? manualStatus;
    if (override is Map && override['amount'] == amount && override['paid'] == paid && override['due'] == (d['due'] ?? '')) {
      manualStatus = switch (override['status']) {
        'Pending' => InvoiceStatus.due,
        'Overdue' => InvoiceStatus.overdue,
        _ => null,
      };
    }
    final issued = parseDay(d['issued']) ?? DateTime.now();
    return Invoice(
      id: id,
      title: [d['term'], 'Fees'].where((e) => e != null && '$e'.isNotEmpty).join(' '),
      issued: issued,
      due: parseDay(d['due']) ?? issued,
      items: lines.isEmpty ? [FeeItem('School fees', amount)] : lines,
      paid: paid,
      manualStatus: manualStatus,
      billedAmount: amount,
      studentId: '${d['studentId'] ?? ''}',
    );
  }
}
