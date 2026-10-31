import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/app_config.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../family/models/family_models.dart';
import '../../family/screens/widgets/child_switcher.dart';
import '../../teachers/screens/widgets/contact_actions.dart';
import '../bloc/certificate_action_bloc.dart';
import '../bloc/certificates_bloc.dart';
import '../models/certificate_models.dart';
import 'widgets/certificate_art.dart';

enum CertificateSort {
  newest('Newest first'),
  oldest('Oldest first'),
  title('Title (A-Z)');

  const CertificateSort(this.label);
  final String label;
}

/// Figma 5.2 "Certificates": search, category filter, preview sheet, download / share (simulated) and
/// a request form for office certificates. Follows the child switcher.
class CertificatesScreen extends StatelessWidget {
  const CertificatesScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<CertificateActionBloc>(),
    child: BlocListener<CertificateActionBloc, CertificateActionState>(
      listenWhen: (a, b) =>
          a.status != b.status &&
          (b.status == CertificateActionStatus.success ||
              (b.status == CertificateActionStatus.failure && b.error != null)),
      listener: (context, s) {
        if (s.status == CertificateActionStatus.failure) {
          AppDialogs.showSnackBar(context, message: s.error!, isError: true);
          return;
        }
        final c = s.certificate!;
        AppDialogs.showSnackBar(
          context,
          message: s.action == CertificateAction.download
              ? (AppConfig.isFirebase
                    ? 'Opened ${c.title}'
                    : '${c.fileName} saved to Downloads (simulated)')
              : '${c.title} requested. The office will notify you when it is ready.',
        );
      },
      child: DetailScaffold(
        title: 'Certificates',
        subtitle: 'Awards, bonafide and more',
        fallbackRoute: RoutePaths.more,
        actions: const [HubHeaderActions()],
        body: ColoredBox(
          color: C.surface,
          child: Column(
            children: [
              const ChildSwitcher(),
              Expanded(
                child: ChildDataView<CertificatesBloc, List<Certificate>>(
                  create: () => getIt<CertificatesBloc>(),
                  refreshable: false,
                  builder: (context, data, child) =>
                      _CertificatesBody(certificates: data, child: child),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _CertificatesBody extends StatefulWidget {
  const _CertificatesBody({required this.certificates, required this.child});
  final List<Certificate> certificates;
  final Child child;
  @override
  State<_CertificatesBody> createState() => _CertificatesBodyState();
}

class _CertificatesBodyState extends State<_CertificatesBody> {
  static const _all = 'All';
  final _search = TextEditingController();
  String _query = '';
  String _category = _all;
  CertificateSort _sort = CertificateSort.newest;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<Certificate> get _visible {
    final list = widget.certificates
        .where((c) => c.matches(_query))
        .where((c) => _category == _all || c.category.label == _category)
        .toList();
    list.sort(
      (a, b) => switch (_sort) {
        CertificateSort.newest => b.issuedOn.compareTo(a.issuedOn),
        CertificateSort.oldest => a.issuedOn.compareTo(b.issuedOn),
        CertificateSort.title => a.title.compareTo(b.title),
      },
    );
    return list;
  }

  int _count(String cat) => cat == _all
      ? widget.certificates.length
      : widget.certificates.where((c) => c.category.label == cat).length;

  Future<void> _pickSort() async {
    final s = await showPickSheet<CertificateSort>(
      context,
      title: 'Sort certificates',
      items: CertificateSort.values,
      label: (s) => s.label,
      selected: _sort,
    );
    if (s != null) setState(() => _sort = s);
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visible;
    final cats = [_all, ...CertificateCategory.values.map((c) => c.label)];
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 24.h),
            children: [
              AppSearchField(
                controller: _search,
                hint: 'Search certificates, credentials, or award ID...',
                onChanged: (v) => setState(() => _query = v),
                trailing: Tooltip(
                  message: 'Sort certificates',
                  child: Material(
                    color: C.bg,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(R.lg),
                      side: const BorderSide(color: C.panelBorder),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(R.lg),
                      onTap: _pickSort,
                      child: SizedBox(
                        width: 48.r,
                        height: 48.r,
                        child: Icon(
                          Icons.tune_rounded,
                          color: C.ink,
                          size: 22.r,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              SizedBox(height: 10.h),
              AppSolidChips(
                items: cats,
                value: _category,
                labelOf: (c) => '$c (${_count(c)})',
                onChanged: (c) => setState(() => _category = c),
              ),
              SizedBox(height: 12.h),
              if (visible.isEmpty)
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 32.h),
                  child: widget.certificates.isEmpty
                      ? AppEmptyState(
                          'No certificates yet',
                          hint:
                              'Request one below; it appears here when the school office issues it.',
                          icon: Icons.workspace_premium_outlined,
                        )
                      : AppEmptyState(
                          'No certificates found',
                          hint: 'Try another search or category.',
                          icon: Icons.workspace_premium_outlined,
                          action: AppButton(
                            'Clear filters',
                            kind: BtnKind.outline,
                            expand: false,
                            small: true,
                            onPressed: () => setState(() {
                              _search.clear();
                              _query = '';
                              _category = _all;
                            }),
                          ),
                        ),
                )
              else
                for (final c in visible)
                  _CertificateCard(certificate: c, child: widget.child),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: EdgeInsets.fromLTRB(16.w, 10.h, 16.w, 12.h),
            decoration: const BoxDecoration(
              color: C.bg,
              border: Border(top: BorderSide(color: C.border)),
            ),
            child: AppButton(
              'Request a Certificate',
              icon: Icons.add_rounded,
              kind: BtnKind.soft,
              onPressed: () => _showRequestSheet(context, widget.child),
            ),
          ),
        ),
      ],
    );
  }
}

void _download(BuildContext context, Certificate c) => context
    .read<CertificateActionBloc>()
    .add(DownloadCertificate(childId: c.childId, certificateId: c.id));

void _share(BuildContext context, Certificate c) => AppDialogs.showSnackBar(
  context,
  message: 'Share sheet opened for ${c.fileName} (simulated)',
);

Future<void> showCertificatePreview(
  BuildContext context,
  Certificate c,
  Child child,
) => showAppSheet<void>(
  context,
  title: c.title,
  subtitle: c.summary,
  builder: (ctx) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(R.md),
        child: CertificateArt(
          certificate: c,
          childName: child.name,
          height: 220,
        ),
      ),
      SizedBox(height: 12.h),
      Row(
        children: [
          Expanded(
            child: AppInfoTile(
              compact: true,
              icon: Icons.event_rounded,
              label: c.requested ? 'REQUESTED ON' : 'ISSUED ON',
              value: fmtDate(c.issuedOn, year: true),
            ),
          ),
          SizedBox(width: 8.w),
          Expanded(
            child: AppInfoTile(
              compact: true,
              icon: Icons.account_balance_outlined,
              label: 'ISSUED BY',
              value: c.issuer,
            ),
          ),
        ],
      ),
      if (c.refNo != null || c.validTill != null) ...[
        SizedBox(height: 8.h),
        Row(
          children: [
            if (c.refNo != null)
              Expanded(
                child: AppInfoTile(
                  compact: true,
                  icon: Icons.tag_rounded,
                  label: 'REFERENCE',
                  value: c.refNo!,
                ),
              ),
            if (c.refNo != null && c.validTill != null) SizedBox(width: 8.w),
            if (c.validTill != null)
              Expanded(
                child: AppInfoTile(
                  compact: true,
                  icon: Icons.verified_outlined,
                  label: 'VALID TILL',
                  value: fmtDate(c.validTill!, year: true),
                ),
              ),
          ],
        ),
      ],
      SizedBox(height: 8.h),
      AppInfoTile(
        icon: Icons.lock_outline_rounded,
        label: 'VERIFICATION',
        value: c.requested
            ? c.signature
            : '${c.size.isEmpty ? 'Paper copy at the school office' : 'PDF • ${c.size}'} • ${c.signature}',
      ),
      SizedBox(height: 16.h),
      if (c.requested)
        AppButton(
          'Close',
          kind: BtnKind.outline,
          onPressed: () => Navigator.pop(ctx),
        )
      else
        Row(
          children: [
            Expanded(
              child: AppButton(
                'Share',
                icon: Icons.ios_share_rounded,
                kind: BtnKind.outline,
                onPressed: () {
                  Navigator.pop(ctx);
                  _share(context, c);
                },
              ),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: AppButton(
                'Download',
                icon: Icons.download_rounded,
                onPressed: () {
                  Navigator.pop(ctx);
                  _download(context, c);
                },
              ),
            ),
          ],
        ),
    ],
  ),
);

class _CertificateCard extends StatelessWidget {
  const _CertificateCard({required this.certificate, required this.child});
  final Certificate certificate;
  final Child child;

  @override
  Widget build(BuildContext context) {
    final c = certificate;
    return AppSurfaceCard(
      margin: EdgeInsets.only(bottom: 14.h),
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            label: 'Preview ${c.title}',
            child: GestureDetector(
              onTap: () => showCertificatePreview(context, c, child),
              child: CertificateArt(certificate: c, childName: child.name),
            ),
          ),
          Padding(
            padding: EdgeInsets.all(14.w),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(c.title, style: T.h2.copyWith(color: C.onSurface)),
                SizedBox(height: 2.h),
                Text(
                  c.requested
                      ? [c.summary, 'Requested ${fmtShort(c.issuedOn)}'].where((s) => s.isNotEmpty).join(' • ')
                      : [c.summary, 'Issued ${fmtShort(c.issuedOn)} ${c.issuedOn.year}'].where((s) => s.isNotEmpty).join(' • '),
                  style: T.small.copyWith(color: C.onSurfaceVariant),
                ),
                SizedBox(height: 10.h),
                Wrap(
                  spacing: 8.w,
                  runSpacing: 6.h,
                  children: [
                    for (var i = 0; i < c.tags.length; i++)
                      Pill(
                        c.tags[i],
                        tone: c.requested
                            ? Tone.warning
                            : i == 0
                            ? Tone.neutral
                            : Tone.brand,
                        icon: i == 0
                            ? (c.requested
                                  ? Icons.hourglass_top_rounded
                                  : Icons.lock_outline_rounded)
                            : null,
                      ),
                  ],
                ),
                Divider(height: 24.h, color: C.border),
                Row(
                  children: [
                    Icon(
                      Icons.picture_as_pdf_outlined,
                      size: 16.r,
                      color: C.slate,
                    ),
                    SizedBox(width: 6.w),
                    Expanded(
                      child: Text(
                        c.requested
                            ? c.signature
                            : '${c.size.isEmpty ? 'Paper copy at the school office' : 'PDF • ${c.size}'} • ${c.signature}',
                        style: T.small,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (c.downloadedAt != null)
                      const Pill(
                        'Downloaded',
                        tone: Tone.success,
                        icon: Icons.check_rounded,
                      ),
                  ],
                ),
                SizedBox(height: 12.h),
                Row(
                  children: [
                    Expanded(
                      child: AppButton(
                        'Preview',
                        icon: Icons.visibility_outlined,
                        kind: BtnKind.outline,
                        small: true,
                        onPressed: () =>
                            showCertificatePreview(context, c, child),
                      ),
                    ),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: AppButton(
                        c.requested ? 'Processing' : 'Download',
                        icon: c.requested
                            ? Icons.hourglass_top_rounded
                            : Icons.download_rounded,
                        small: true,
                        onPressed: c.requested
                            ? null
                            : () => _download(context, c),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> _showRequestSheet(BuildContext context, Child child) {
  final bloc = context.read<CertificateActionBloc>()
    ..add(const ResetCertificateAction());
  return showAppSheet<void>(
    context,
    title: 'Request a Certificate',
    subtitle: 'The school office prepares it in about 2 working days.',
    builder: (_) => BlocProvider.value(
      value: bloc,
      child: _RequestForm(child: child),
    ),
  );
}

class _RequestForm extends StatefulWidget {
  const _RequestForm({required this.child});
  final Child child;
  @override
  State<_RequestForm> createState() => _RequestFormState();
}

class _RequestFormState extends State<_RequestForm> {
  CertificateRequestType? _type;
  final _purpose = TextEditingController();

  @override
  void dispose() {
    _purpose.dispose();
    super.dispose();
  }

  Widget _error(String? t) => t == null
      ? const SizedBox.shrink()
      : Padding(
          padding: EdgeInsets.only(top: 6.h, bottom: 6.h),
          child: Text(t, style: T.small.copyWith(color: C.danger)),
        );

  @override
  Widget build(BuildContext context) =>
      BlocConsumer<CertificateActionBloc, CertificateActionState>(
        listenWhen: (a, b) =>
            a.status != b.status &&
            b.status == CertificateActionStatus.success &&
            b.action == CertificateAction.request,
        listener: (context, _) => Navigator.of(context).pop(),
        builder: (context, s) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppPickTile(
              key: const Key('cert-type'),
              icon: Icons.workspace_premium_outlined,
              caption: 'CERTIFICATE',
              label: _type?.label ?? 'Choose a certificate',
              onTap: () async {
                final t = await showPickSheet<CertificateRequestType>(
                  context,
                  title: 'Certificate type',
                  items: CertificateRequestType.values,
                  label: (t) => t.label,
                  selected: _type,
                );
                if (t != null) setState(() => _type = t);
              },
            ),
            _error(s.errors['type']),
            SizedBox(height: 12.h),
            AppTextField(
              key: const Key('cert-purpose'),
              label: 'Purpose',
              controller: _purpose,
              hint: 'e.g. Passport application',
              maxLines: 2,
              maxLength: 120,
            ),
            _error(s.errors['purpose']),
            if (s.error != null) _error(s.error),
            AppButton(
              'Submit Request',
              icon: Icons.send_rounded,
              busy: s.submitting,
              onPressed: () => context.read<CertificateActionBloc>().add(
                RequestCertificate(
                  childId: widget.child.id,
                  type: _type,
                  purpose: _purpose.text,
                ),
              ),
            ),
          ],
        ),
      );
}
