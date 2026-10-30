import 'package:flutter/material.dart';
import '../../../config/app_config.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../academics/screens/widgets/academic_section_title.dart';
import '../../family/models/family_models.dart';
import '../../family/screens/widgets/parent_tab_header.dart';
import '../bloc/fee_payment_bloc.dart';
import '../bloc/fees_bloc.dart';
import '../models/fee_models.dart';
import 'widgets/bank_transfer_flow.dart';
import 'widgets/fee_pay_flow.dart';

Tone invoiceTone(InvoiceStatus s) => switch (s) {
  InvoiceStatus.paid => Tone.success,
  InvoiceStatus.partial => Tone.warning,
  InvoiceStatus.due => Tone.brand,
  InvoiceStatus.overdue => Tone.danger,
};

/// Fees tab: dues summary, upcoming instalments, reported payments, receipts history and Pay Now (to the school
/// account with verification by the office, or the simulated online flow of the demo).
class FeesScreen extends StatelessWidget {
  const FeesScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider<FeePaymentBloc>(
    create: (_) => getIt<FeePaymentBloc>(),
    child: BlocListener<FeePaymentBloc, FeePaymentState>(
      listenWhen: (a, b) => a.status != b.status,
      listener: (context, s) {
        final bloc = context.read<FeePaymentBloc>();
        if (s.status == PaymentStatus.failure) {
          AppDialogs.showSnackBar(
            context,
            message: s.error ?? 'Payment failed. Please try again.',
            isError: true,
          );
        }
        if (s.status == PaymentStatus.reported && s.claim != null) {
          AppDialogs.showSnackBar(
            context,
            message: '${inr(s.claim!.amount)} sent for verification. Your receipt appears here once the school office confirms it.',
          );
        }
        if (s.status == PaymentStatus.success && s.receipt != null) {
          AppDialogs.showSnackBar(
            context,
            message: '${inr(s.receipt!.amount)} paid successfully',
          );
          showReceiptSheet(
            context,
            receipt: s.receipt!,
            bloc: bloc,
            success: true,
          );
        }
      },
      child: BlocListener<FeePaymentBloc, FeePaymentState>(
        listenWhen: (a, b) => a.downloadCount != b.downloadCount,
        listener: (context, s) => AppDialogs.showSnackBar(
          context,
          message: '${s.downloaded} saved to Downloads',
        ),
        child: ColoredBox(
          color: C.surface,
          child: Column(
            children: [
              const ParentTabHeader(title: 'Fees'),
              Expanded(
                child: ChildDataView<FeesBloc, FeesData>(
                  create: () => getIt<FeesBloc>(),
                  isEmpty: (d) => d.invoices.isEmpty,
                  emptyTitle: 'No invoices',
                  emptyHint: 'Fee invoices will appear here when issued.',
                  emptyIcon: Icons.receipt_long_outlined,
                  builder: (context, data, child) =>
                      _FeesBody(data: data, child: child),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _FeesBody extends StatelessWidget {
  const _FeesBody({required this.data, required this.child});
  final FeesData data;
  final Child child;

  void _pay(BuildContext context, {List<String>? preselect}) {
    // the school takes fees into its account: pay there, then report it for verification
    if (data.bank != null) {
      startBankTransferFlow(
        context,
        bloc: context.read<FeePaymentBloc>(),
        childId: child.id,
        data: data,
        preselect: preselect?.firstOrNull,
      );
      return;
    }
    // no payment gateway is connected to the school system and no account was published
    if (AppConfig.isFirebase) {
      AppDialogs.showSnackBar(
        context,
        message: 'Please pay at the school office; the receipt will appear here.',
      );
      return;
    }
    startPayFlow(
      context,
      bloc: context.read<FeePaymentBloc>(),
      childId: child.id,
      unpaid: data.unpaid,
      preselect: preselect,
    );
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final unpaid = data.unpaid;
    final overdue = unpaid
        .where((i) => i.statusAt(now) == InvoiceStatus.overdue)
        .toList();
    final next = data.nextDue;
    return ListView(
      key: const Key('section-list'),
      padding: academicListPadding(),
      children: [
        AppSurfaceCard(
          hero: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const AppEyebrow('Total outstanding'),
                        SizedBox(height: 8.h),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            inr(data.balance),
                            key: const Key('fee-balance'),
                            style: T.title.copyWith(
                              fontSize: 28.sp,
                              color: C.onSurface,
                            ),
                          ),
                        ),
                        SizedBox(height: 2.h),
                        Text(
                          next == null
                              ? 'All instalments are paid'
                              : 'Next due ${fmtDate(next, year: true)}',
                          style: T.small.copyWith(color: C.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  if (overdue.isNotEmpty)
                    Pill('${overdue.length} overdue', tone: Tone.danger)
                  else
                    Pill(
                      unpaid.isEmpty ? 'All clear' : 'On time',
                      tone: Tone.success,
                    ),
                ],
              ),
              SizedBox(height: 14.h),
              AppProgress(data.total == 0 ? 0 : data.paid / data.total),
              SizedBox(height: 6.h),
              Text(
                '${data.total == 0 ? 0 : (data.paid / data.total * 100).round()}% of annual fees paid',
                style: T.small.copyWith(
                  fontSize: 11.sp,
                  color: C.onSurfaceVariant,
                ),
              ),
              SizedBox(height: 12.h),
              Row(
                children: [
                  Expanded(
                    child: AppMetricBox(
                      icon: Icons.check_circle_outline_rounded,
                      value: inr(data.paid),
                      label: 'Paid so far',
                      tone: Tone.success,
                    ),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: AppMetricBox(
                      icon: Icons.account_balance_wallet_outlined,
                      value: inr(data.total),
                      label: 'Total fees',
                    ),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: AppMetricBox(
                      icon: Icons.receipt_long_outlined,
                      value: '${data.receipts.length}',
                      label: 'Receipts',
                      tone: Tone.purple,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 14.h),
              BlocBuilder<FeePaymentBloc, FeePaymentState>(
                buildWhen: (a, b) => a.isProcessing != b.isProcessing,
                builder: (context, s) => AppButton(
                  unpaid.isEmpty ? 'No dues' : 'Pay Now',
                  key: const Key('pay-now'),
                  icon: Icons.payments_outlined,
                  busy: s.isProcessing,
                  onPressed: unpaid.isEmpty ? null : () => _pay(context),
                ),
              ),
            ],
          ),
        ),
        AcademicSectionTitle(
          'Upcoming instalments',
          icon: Icons.event_note_outlined,
          caption: '${unpaid.length} pending',
        ),
        if (unpaid.isEmpty)
          AppSurfaceCard(
            child: AppEmptyState(
              'Nothing due',
              hint: 'All fee instalments are paid. Thank you!',
              icon: Icons.verified_outlined,
            ),
          )
        else
          for (final i in unpaid)
            AppEntryCard(
              key: Key('invoice-${i.id}'),
              icon: i.statusAt(now) == InvoiceStatus.overdue
                  ? Icons.warning_amber_rounded
                  : Icons.receipt_outlined,
              tone: invoiceTone(i.statusAt(now)),
              title: i.title,
              badge: Pill(
                i.statusAt(now).label,
                tone: invoiceTone(i.statusAt(now)),
              ),
              meta: 'Due ${fmtDate(i.due, year: true)}',
              trailing: Text(
                inr(i.balance),
                style: T.h3.copyWith(color: C.onSurface),
              ),
              footer: [
                for (final it in i.items)
                  AppMetaChip(it.label, icon: Icons.label_outline_rounded),
              ],
              onTap: () => _showInvoice(context, i),
            ),
        if (data.claims.any((c) => c.status != ClaimStatus.verified)) ...[
          AcademicSectionTitle(
            'Reported payments',
            icon: Icons.fact_check_outlined,
            caption: '${data.pendingClaims.length} being verified',
          ),
          for (final c in data.claims.where((c) => c.status != ClaimStatus.verified))
            AppEntryCard(
              key: Key('claim-${c.id}'),
              icon: c.status == ClaimStatus.rejected ? Icons.error_outline_rounded : Icons.hourglass_top_rounded,
              tone: c.status == ClaimStatus.rejected ? Tone.danger : Tone.warning,
              title: inr(c.amount),
              badge: Pill(c.status.label, tone: c.status == ClaimStatus.rejected ? Tone.danger : Tone.warning),
              meta: '${c.invoiceTitle} • paid ${fmtDate(c.paidOn, year: true)}',
              footer: [
                AppMetaChip(c.mode.label, icon: Icons.account_balance_outlined),
                AppMetaChip(c.reference, icon: Icons.tag_rounded),
                if (c.reason != null) AppMetaChip(c.reason!, icon: Icons.info_outline_rounded, color: C.danger),
              ],
            ),
        ],
        AcademicSectionTitle(
          'Receipts history',
          icon: Icons.history_rounded,
          caption: '${data.receipts.length} receipts',
        ),
        if (data.receipts.isEmpty)
          AppSurfaceCard(
            child: AppEmptyState(
              'No payments yet',
              hint: 'Receipts appear here after you pay.',
              icon: Icons.receipt_long_outlined,
            ),
          )
        else
          for (final r in data.receipts)
            AppEntryCard(
              key: Key('receipt-${r.id}'),
              icon: Icons.receipt_long_rounded,
              tone: Tone.success,
              title: inr(r.amount),
              meta: '${r.number} • ${fmtDate(r.date, year: true)}',
              trailing: IconButton(
                tooltip: 'Download receipt',
                onPressed: () => context.read<FeePaymentBloc>().add(
                  ReceiptDownloadRequested(r),
                ),
                icon: Icon(
                  Icons.download_rounded,
                  color: C.primary,
                  size: 22.r,
                ),
              ),
              footer: [
                AppMetaChip(r.method.label, icon: Icons.payments_outlined),
                for (final l in r.lines)
                  AppMetaChip(
                    l.label,
                    icon: Icons.check_rounded,
                    color: C.successDark,
                  ),
              ],
              onTap: () => showReceiptSheet(
                context,
                receipt: r,
                bloc: context.read<FeePaymentBloc>(),
              ),
            ),
        academicListEnd(),
      ],
    );
  }

  void _showInvoice(BuildContext context, Invoice i) {
    final now = DateTime.now();
    showAppSheet<void>(
      feeSheetContext(context),
      title: i.title,
      subtitle:
          'Issued ${fmtDate(i.issued, year: true)} • due ${fmtDate(i.due, year: true)}',
      builder: (ctx) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppSurfaceCard(
            padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 8.h),
            child: Column(
              children: [
                for (final it in i.items) _Row(it.label, inr(it.amount)),
                const Divider(color: C.outline),
                _Row('Total', inr(i.amount), strong: true),
                _Row('Paid', inr(i.paid)),
                _Row(
                  'Balance',
                  inr(i.balance),
                  strong: true,
                  color: i.statusAt(now) == InvoiceStatus.overdue
                      ? C.danger
                      : C.onSurface,
                ),
              ],
            ),
          ),
          SizedBox(height: 14.h),
          AppButton(
            'Pay this instalment',
            key: const Key('pay-single'),
            icon: Icons.payments_outlined,
            onPressed: () {
              Navigator.pop(ctx);
              _pay(context, preselect: [i.id]);
            },
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value, {this.strong = false, this.color});
  final String label, value;
  final bool strong;
  final Color? color;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 5.h),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: (strong ? T.bodyStrong : T.body).copyWith(
              color: strong ? C.onSurface : C.onSurfaceVariant,
            ),
          ),
        ),
        Text(value, style: T.bodyStrong.copyWith(color: color ?? C.onSurface)),
      ],
    ),
  );
}
