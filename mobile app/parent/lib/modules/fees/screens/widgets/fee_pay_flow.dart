import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../bloc/fee_payment_bloc.dart';
import '../../models/fee_models.dart';

/// Sheets of the Fees tab open on the root navigator so they cover the floating dock.
BuildContext feeSheetContext(BuildContext context) =>
    Navigator.of(context, rootNavigator: true).context;

/// Pay Now flow (simulated gateway): select instalments -> choose a method -> pay.
/// The success receipt is shown by the screen's listener once [FeePaymentBloc] reports success.
Future<void> startPayFlow(
  BuildContext context, {
  required FeePaymentBloc bloc,
  required String childId,
  required List<Invoice> unpaid,
  List<String>? preselect,
}) async {
  if (unpaid.isEmpty) {
    AppDialogs.showSnackBar(
      context,
      message: 'All fees are paid. Nothing due.',
    );
    return;
  }
  final ids = await showAppSheet<List<String>>(
    feeSheetContext(context),
    title: 'Select instalments',
    subtitle: 'Choose what you want to pay now.',
    builder: (ctx) => _SelectSheet(
      unpaid: unpaid,
      initial: preselect ?? [for (final i in unpaid) i.id],
    ),
  );
  if (ids == null || ids.isEmpty || !context.mounted) return;
  final total = unpaid
      .where((i) => ids.contains(i.id))
      .fold<double>(0, (a, i) => a + i.balance);
  final method = await showAppSheet<PaymentMethod>(
    feeSheetContext(context),
    title: 'Choose payment method',
    subtitle:
        'Paying ${inr(total)} for ${ids.length} instalment${ids.length == 1 ? '' : 's'}',
    builder: (ctx) => _MethodSheet(total: total),
  );
  if (method == null) return;
  bloc.add(
    FeePaymentSubmitted(childId: childId, invoiceIds: ids, method: method),
  );
}

class _SelectSheet extends StatefulWidget {
  const _SelectSheet({required this.unpaid, required this.initial});
  final List<Invoice> unpaid;
  final List<String> initial;

  @override
  State<_SelectSheet> createState() => _SelectSheetState();
}

class _SelectSheetState extends State<_SelectSheet> {
  late final Set<String> _picked = {...widget.initial};

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final total = widget.unpaid
        .where((i) => _picked.contains(i.id))
        .fold<double>(0, (a, i) => a + i.balance);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final i in widget.unpaid)
          Padding(
            padding: EdgeInsets.only(bottom: 8.h),
            child: AppSurfaceCard(
              padding: EdgeInsets.zero,
              borderColor: _picked.contains(i.id)
                  ? C.primary.withValues(alpha: .5)
                  : null,
              child: CheckboxListTile(
                key: Key('pick-${i.id}'),
                value: _picked.contains(i.id),
                onChanged: (v) => setState(
                  () => v == true ? _picked.add(i.id) : _picked.remove(i.id),
                ),
                controlAffinity: ListTileControlAffinity.leading,
                activeColor: C.primary,
                contentPadding: EdgeInsets.symmetric(horizontal: 8.w),
                title: Text(
                  i.title,
                  style: T.bodyStrong.copyWith(color: C.onSurface),
                ),
                subtitle: Text(
                  'Due ${fmtDate(i.due, year: true)} • ${i.statusAt(now).label}',
                  style: T.small.copyWith(
                    color: i.statusAt(now) == InvoiceStatus.overdue
                        ? C.danger
                        : C.onSurfaceVariant,
                  ),
                ),
                secondary: Text(inr(i.balance), style: T.bodyStrong),
              ),
            ),
          ),
        SizedBox(height: 8.h),
        Row(
          children: [
            Expanded(
              child: Text(
                'Total',
                style: T.body.copyWith(color: C.onSurfaceVariant),
              ),
            ),
            Text(
              inr(total),
              key: const Key('pay-total'),
              style: T.h2.copyWith(color: C.onSurface),
            ),
          ],
        ),
        SizedBox(height: 14.h),
        AppButton(
          'Continue',
          key: const Key('pay-continue'),
          icon: Icons.arrow_forward_rounded,
          onPressed: _picked.isEmpty
              ? null
              : () => Navigator.pop(context, [
                  for (final i in widget.unpaid)
                    if (_picked.contains(i.id)) i.id,
                ]),
        ),
      ],
    );
  }
}

class _MethodSheet extends StatefulWidget {
  const _MethodSheet({required this.total});
  final double total;

  @override
  State<_MethodSheet> createState() => _MethodSheetState();
}

class _MethodSheetState extends State<_MethodSheet> {
  PaymentMethod _method = PaymentMethod.upi;

  static IconData _icon(PaymentMethod m) => switch (m) {
    PaymentMethod.upi => Icons.qr_code_2_rounded,
    PaymentMethod.card => Icons.credit_card_rounded,
    PaymentMethod.netBanking => Icons.account_balance_rounded,
  };

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (final m in PaymentMethod.values)
        Padding(
          padding: EdgeInsets.only(bottom: 8.h),
          child: AppSurfaceCard(
            key: Key('method-${m.name}'),
            onTap: () => setState(() => _method = m),
            semanticLabel: m.label,
            borderColor: _method == m ? C.primary.withValues(alpha: .6) : null,
            color: _method == m ? C.primarySoft : C.bg,
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h),
            child: Row(
              children: [
                IconTile(_icon(m), size: 40),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        m.label,
                        style: T.bodyStrong.copyWith(color: C.onSurface),
                      ),
                      Text(
                        m.hint,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.small.copyWith(color: C.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                Icon(
                  _method == m
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded,
                  color: _method == m ? C.primary : C.muted,
                  size: 22.r,
                ),
              ],
            ),
          ),
        ),
      SizedBox(height: 6.h),
      Row(
        children: [
          Icon(Icons.lock_outline_rounded, size: 14.r, color: C.slate),
          SizedBox(width: 6.w),
          Expanded(
            child: Text(
              'Secure demo checkout. No real money is charged.',
              style: T.small,
            ),
          ),
        ],
      ),
      SizedBox(height: 14.h),
      AppButton(
        'Pay ${inr(widget.total)}',
        key: const Key('pay-confirm'),
        icon: Icons.lock_rounded,
        onPressed: () => Navigator.pop(context, _method),
      ),
    ],
  );
}

/// Receipt sheet: shown after a successful payment ([success]) and when opening a past receipt.
Future<void> showReceiptSheet(
  BuildContext context, {
  required FeeReceipt receipt,
  required FeePaymentBloc bloc,
  bool success = false,
}) => showAppSheet<void>(
  feeSheetContext(context),
  title: success ? 'Payment successful' : 'Fee receipt',
  subtitle: success
      ? 'Your receipt has been generated.'
      : 'Receipt ${receipt.number}',
  builder: (ctx) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      AppSurfaceCard(
        hero: true,
        child: Column(
          children: [
            Container(
              width: 56.r,
              height: 56.r,
              decoration: const BoxDecoration(
                color: C.successSoft,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.check_rounded,
                color: C.successDark,
                size: 32.r,
              ),
            ),
            SizedBox(height: 10.h),
            Text(
              inr(receipt.amount),
              key: const Key('receipt-amount'),
              style: T.title.copyWith(fontSize: 28.sp, color: C.onSurface),
            ),
            Text(
              'Paid via ${receipt.method.label}',
              style: T.small.copyWith(color: C.onSurfaceVariant),
            ),
            SizedBox(height: 14.h),
            const Divider(height: 1, color: C.outline),
            SizedBox(height: 10.h),
            _Line('Receipt no.', receipt.number),
            _Line(
              'Date',
              '${fmtDate(receipt.date, year: true)}, ${fmtClock(receipt.date)}',
            ),
            if (receipt.reference != null)
              _Line('Reference', receipt.reference!),
            SizedBox(height: 6.h),
            const Divider(height: 1, color: C.outline),
            SizedBox(height: 6.h),
            for (final l in receipt.lines) _Line(l.label, inr(l.amount)),
          ],
        ),
      ),
      SizedBox(height: 14.h),
      AppButton(
        'Download receipt',
        key: const Key('receipt-download'),
        icon: Icons.download_rounded,
        kind: BtnKind.outline,
        onPressed: () => bloc.add(ReceiptDownloadRequested(receipt)),
      ),
      SizedBox(height: 10.h),
      AppButton(
        'Done',
        key: const Key('receipt-done'),
        onPressed: () => Navigator.pop(ctx),
      ),
    ],
  ),
);

class _Line extends StatelessWidget {
  const _Line(this.label, this.value);
  final String label, value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 4.h),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: T.small.copyWith(color: C.onSurfaceVariant),
          ),
        ),
        SizedBox(width: 8.w),
        Text(value, style: T.smallStrong.copyWith(color: C.onSurface)),
      ],
    ),
  );
}
