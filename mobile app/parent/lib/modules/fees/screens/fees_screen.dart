import 'package:flutter/material.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../family/screens/widgets/child_switcher.dart';
import '../bloc/fees_bloc.dart';
import '../models/fee_models.dart';

Tone invoiceTone(InvoiceStatus s) => switch (s) {
  InvoiceStatus.paid => Tone.success,
  InvoiceStatus.partial => Tone.warning,
  InvoiceStatus.due => Tone.brand,
  InvoiceStatus.overdue => Tone.danger,
};

/// Fee summary and invoices (view only, no payment).
class FeesScreen extends StatelessWidget {
  const FeesScreen({super.key});

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Fees',
    subtitle: 'Summary and invoices',
    fallbackRoute: RoutePaths.more,
    body: Column(
      children: [
        const ChildSwitcher(),
        Expanded(
          child: ChildDataView<FeesBloc, FeesData>(
            create: () => getIt<FeesBloc>(),
            isEmpty: (d) => d.invoices.isEmpty,
            emptyTitle: 'No invoices',
            emptyHint: 'Fee invoices will appear here when issued.',
            emptyIcon: Icons.receipt_long_outlined,
            builder: (context, data, child) {
              final now = DateTime.now();
              final next = data.nextDue;
              return ListView(
                padding: EdgeInsets.fromLTRB(S.page, 8.h, S.page, 24.h),
                children: [
                  PanelCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('BALANCE DUE', style: T.caps),
                        SizedBox(height: 2.h),
                        Text(
                          inr(data.balance),
                          key: const Key('fee-balance'),
                          style: T.title,
                        ),
                        if (next != null)
                          Text(
                            'Next due date: ${fmtDate(next, year: true)}',
                            style: T.small,
                          ),
                        SizedBox(height: 12.h),
                        AppProgress(
                          data.total == 0 ? 0 : data.paid / data.total,
                          tone: Tone.success,
                        ),
                        SizedBox(height: 6.h),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Paid ${inr(data.paid)}',
                                style: T.small,
                              ),
                            ),
                            Text('Total ${inr(data.total)}', style: T.small),
                          ],
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 10.h),
                  AppCard(
                    color: C.surface,
                    padding: EdgeInsets.all(12.w),
                    child: Row(
                      children: [
                        Icon(
                          Icons.info_outline_rounded,
                          size: 18.r,
                          color: C.slate,
                        ),
                        SizedBox(width: 8.w),
                        Expanded(
                          child: Text(
                            'Online payment is not available in this app yet. Please pay at the school office.',
                            style: T.small,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SectionHeader('Invoices'),
                  for (final i in data.invoices)
                    _InvoiceCard(invoice: i, now: now),
                ],
              );
            },
          ),
        ),
      ],
    ),
  );
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.invoice, required this.now});
  final Invoice invoice;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final status = invoice.statusAt(now);
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        padding: EdgeInsets.zero,
        child: Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 4.h),
            childrenPadding: EdgeInsets.fromLTRB(14.w, 0, 14.w, 14.h),
            shape: const Border(),
            collapsedShape: const Border(),
            title: Text(invoice.title, style: T.h3),
            subtitle: Text(
              '${inr(invoice.amount)} - due ${fmtShort(invoice.due)}',
              style: T.small,
            ),
            trailing: Pill(status.label, tone: invoiceTone(status)),
            children: [
              for (final it in invoice.items)
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 4.h),
                  child: Row(
                    children: [
                      Expanded(child: Text(it.label, style: T.body)),
                      Text(inr(it.amount), style: T.bodyStrong),
                    ],
                  ),
                ),
              const Divider(),
              Row(
                children: [
                  Expanded(child: Text('Paid', style: T.small)),
                  Text(inr(invoice.paid), style: T.smallStrong),
                ],
              ),
              SizedBox(height: 4.h),
              Row(
                children: [
                  Expanded(child: Text('Balance', style: T.small)),
                  Text(
                    inr(invoice.balance),
                    style: T.smallStrong.copyWith(
                      color: invoice.balance > 0 ? C.danger : C.successDark,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 4.h),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Issued ${fmtDate(invoice.issued, year: true)}',
                  style: T.small,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
