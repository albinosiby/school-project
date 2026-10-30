import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../bloc/fee_payment_bloc.dart';
import '../../models/fee_models.dart';
import 'fee_pay_flow.dart';

/// Pay Now when the school takes fees into its account: show the account (copyable), then let the parent
/// report the transfer (instalment, amount, mode, reference, date). The office verifies it and issues the receipt.
Future<void> startBankTransferFlow(
  BuildContext context, {
  required FeePaymentBloc bloc,
  required String childId,
  required FeesData data,
  String? preselect,
}) async {
  final bank = data.bank!;
  final unpaid = data.unpaid;
  if (unpaid.isEmpty) {
    AppDialogs.showSnackBar(context, message: 'All fees are paid. Nothing due.');
    return;
  }
  final paid = await showAppSheet<bool>(
    feeSheetContext(context),
    title: 'Pay to the school account',
    subtitle: 'Pay by UPI or bank transfer, then enter the payment details here.',
    builder: (ctx) => _AccountSheet(bank: bank, due: unpaid.fold<double>(0, (a, i) => a + i.balance)),
  );
  if (paid != true || !context.mounted) return;
  final event = await showAppSheet<PaymentReported>(
    feeSheetContext(context),
    title: 'Enter payment details',
    subtitle: 'The school office checks them against the bank statement and issues your receipt.',
    builder: (ctx) => _ReportForm(childId: childId, unpaid: unpaid, preselect: preselect),
  );
  if (event != null) bloc.add(event);
}

class _AccountSheet extends StatelessWidget {
  const _AccountSheet({required this.bank, required this.due});
  final BankDetails bank;
  final double due;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      AppSurfaceCard(
        padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 6.h),
        child: Column(
          children: [
            if (bank.upiId.isNotEmpty) _CopyRow('UPI ID', bank.upiId),
            if (bank.accountName.isNotEmpty) _CopyRow('Account name', bank.accountName),
            if (bank.accountNo.isNotEmpty) _CopyRow('Account number', bank.accountNo),
            if (bank.ifsc.isNotEmpty) _CopyRow('IFSC', bank.ifsc),
            if (bank.bank.isNotEmpty) _CopyRow('Bank', [bank.bank, bank.branch].where((s) => s.isNotEmpty).join(', '), copy: false),
          ],
        ),
      ),
      SizedBox(height: 10.h),
      Text(
        [
          'Total due ${inr(due)}.',
          if (bank.note.isNotEmpty) bank.note else 'Mention the student name or GR number in the payment remarks.',
        ].join(' '),
        style: T.small.copyWith(color: C.onSurfaceVariant),
      ),
      SizedBox(height: 16.h),
      AppButton(
        "I've paid, enter details",
        key: const Key('bank-paid'),
        icon: Icons.fact_check_outlined,
        onPressed: () => Navigator.pop(context, true),
      ),
    ],
  );
}

class _CopyRow extends StatelessWidget {
  const _CopyRow(this.label, this.value, {this.copy = true});
  final String label, value;
  final bool copy;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 4.h),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: T.small.copyWith(fontSize: 11.sp, color: C.onSurfaceVariant)),
              SizedBox(height: 2.h),
              SelectableText(value, style: T.bodyStrong.copyWith(color: C.onSurface)),
            ],
          ),
        ),
        if (copy)
          IconButton(
            tooltip: 'Copy $label',
            icon: Icon(Icons.copy_rounded, size: 18.r, color: C.primary),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: value));
              AppDialogs.showSnackBar(context, message: '$label copied');
            },
          ),
      ],
    ),
  );
}

class _ReportForm extends StatefulWidget {
  const _ReportForm({required this.childId, required this.unpaid, this.preselect});
  final String childId;
  final List<Invoice> unpaid;
  final String? preselect;

  @override
  State<_ReportForm> createState() => _ReportFormState();
}

class _ReportFormState extends State<_ReportForm> {
  final _form = GlobalKey<FormState>();
  late Invoice _invoice = widget.unpaid.firstWhere((i) => i.id == widget.preselect, orElse: () => widget.unpaid.first);
  late final _amount = TextEditingController(text: _invoice.balance.toStringAsFixed(0));
  final _reference = TextEditingController();
  final _note = TextEditingController();
  var _mode = TransferMode.upi;
  var _paidOn = DateTime.now();

  @override
  void dispose() {
    _amount.dispose();
    _reference.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: _paidOn,
      firstDate: now.subtract(const Duration(days: 90)),
      lastDate: now,
    );
    if (d != null) setState(() => _paidOn = d);
  }

  @override
  Widget build(BuildContext context) => Form(
    key: _form,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.unpaid.length > 1) ...[
          Text('Instalment', style: T.smallStrong.copyWith(color: C.slate)),
          SizedBox(height: 6.h),
          AppChoiceChips(
            items: [for (final i in widget.unpaid) i.title],
            value: _invoice.title,
            onChanged: (t) => setState(() {
              _invoice = widget.unpaid.firstWhere((i) => i.title == t);
              _amount.text = _invoice.balance.toStringAsFixed(0);
            }),
          ),
          SizedBox(height: 14.h),
        ],
        AppTextField(
          key: const Key('claim-amount'),
          label: 'Amount paid (₹) · ${_invoice.title} due ${inr(_invoice.balance)}',
          controller: _amount,
          keyboard: TextInputType.number,
          validator: (v) {
            final a = double.tryParse((v ?? '').replaceAll(',', '').trim());
            if (a == null || a <= 0) return 'Enter the amount you paid';
            if (a > _invoice.balance) return 'More than the ${inr(_invoice.balance)} due on this instalment';
            return null;
          },
        ),
        Text('Paid by', style: T.smallStrong.copyWith(color: C.slate)),
        SizedBox(height: 6.h),
        AppChoiceChips(
          items: [for (final m in TransferMode.values) m.label],
          value: _mode.label,
          onChanged: (l) => setState(() => _mode = TransferMode.values.firstWhere((m) => m.label == l)),
        ),
        SizedBox(height: 14.h),
        AppTextField(
          key: const Key('claim-reference'),
          label: _mode.referenceLabel,
          hint: _mode == TransferMode.upi ? '12-digit number from your UPI app' : null,
          controller: _reference,
          validator: (v) => (v ?? '').trim().length < 4 ? 'Enter the ${_mode.referenceLabel}' : null,
        ),
        AppTextField(
          key: Key('claim-date-${_paidOn.toIso8601String()}'),
          label: 'Paid on',
          initial: fmtDate(_paidOn, year: true),
          readOnly: true,
          onTap: _pickDate,
          suffix: const Icon(Icons.calendar_today_outlined),
        ),
        AppTextField(label: 'Note for the office (optional)', controller: _note, maxLines: 2, maxLength: 200),
        SizedBox(height: 4.h),
        AppButton(
          'Send for verification',
          key: const Key('claim-submit'),
          icon: Icons.send_rounded,
          onPressed: () {
            if (!_form.currentState!.validate()) return;
            Navigator.pop(
              context,
              PaymentReported(
                childId: widget.childId,
                invoiceId: _invoice.id,
                amount: double.parse(_amount.text.replaceAll(',', '').trim()),
                mode: _mode,
                reference: _reference.text.trim(),
                paidOn: _paidOn,
                note: _note.text.trim(),
              ),
            );
          },
        ),
      ],
    ),
  );
}
