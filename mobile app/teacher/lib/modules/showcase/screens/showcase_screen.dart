import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';

/// Visual catalogue of every design-system component (route: /showcase).
class ShowcaseScreen extends StatefulWidget {
  const ShowcaseScreen({super.key});
  @override
  State<ShowcaseScreen> createState() => _ShowcaseScreenState();
}

class _ShowcaseScreenState extends State<ShowcaseScreen> {
  String _chip = 'All';
  bool _busy = false;

  Widget _section(String title, List<Widget> children) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SectionHeader(title, caps: true),
        Wrap(spacing: 10.w, runSpacing: 10.h, children: children),
      ]);

  @override
  Widget build(BuildContext context) => DetailScaffold(
        title: 'Design System',
        subtitle: 'Tokens and reusable components',
        body: ListView(padding: EdgeInsets.all(S.page), children: [
          _section('Colors', [
            for (final c in const [C.primary, C.primaryDark, C.primarySoft, C.panel, C.ink, C.slate, C.muted, C.success, C.warning, C.danger, C.purple])
              Container(width: 44.r, height: 44.r, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border))),
          ]),
          _section('Typography', [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Title', style: T.title), Text('Heading 1', style: T.h1), Text('Heading 2', style: T.h2), Text('Heading 3', style: T.h3),
              Text('Body text', style: T.body), Text('Small text', style: T.small), Text('CAPS LABEL', style: T.caps),
            ]),
          ]),
          _section('Buttons', [
            const AppButton('Primary', icon: Icons.check_rounded),
            const AppButton('Outline', kind: BtnKind.outline),
            const AppButton('Soft', kind: BtnKind.soft, expand: false),
            const AppButton('Danger', kind: BtnKind.danger, expand: false),
            AppButton('Loading', busy: _busy, expand: false, onPressed: () async {
              setState(() => _busy = true);
              await Future<void>.delayed(const Duration(seconds: 1));
              if (mounted) setState(() => _busy = false);
            }),
          ]),
          _section('Pills & tones', [for (final t in Tone.values) Pill(t.name, tone: t, dot: true)]),
          _section('Avatars & tiles', [const Avatar('Anita Sharma', size: 48, online: true), for (final t in Tone.values) IconTile(Icons.school_rounded, tone: t)]),
          _section('Progress', [SizedBox(width: double.infinity, child: AppProgress(.62)), SizedBox(width: double.infinity, child: AppProgress(.3, tone: Tone.warning))]),
          _section('Cards & stats', [
            const AppCard(child: Text('AppCard')),
            const PanelCard(child: Text('PanelCard')),
            SizedBox(width: 160.w, child: const StatTile(label: 'Due Today', value: '4', icon: Icons.alarm_rounded)),
          ]),
          _section('Inputs', [
            AppSearchField(hint: 'Search…', onChanged: (_) {}),
            const AppTextField(label: 'Name', hint: 'Enter name'),
            const AppTextField(label: 'Password', obscure: true),
            AppDropdown<String>(label: 'Class', value: '10-B', items: const ['10-A', '10-B', '9-A'], onChanged: (_) {}),
          ]),
          _section('Filter chips', [FilterChips(items: const ['All', 'Today', 'Grading'], value: _chip, onChanged: (v) => setState(() => _chip = v))]),
          _section('Feedback', [
            AppButton('Snackbar', kind: BtnKind.outline, expand: false, onPressed: () => AppDialogs.showSnackBar(context, message: 'Saved')),
            AppButton('Confirm', kind: BtnKind.outline, expand: false, onPressed: () => AppDialogs.showConfirmDialog(context, title: 'Delete?', message: 'This cannot be undone.', danger: true)),
            AppButton('Bottom sheet', kind: BtnKind.outline, expand: false, onPressed: () => showAppSheet<void>(context, title: 'Sheet', builder: (_) => const Text('Content'))),
          ]),
          _section('States', [const AppEmptyState('Nothing here', hint: 'Empty state'), AppErrorWidget(message: 'Something went wrong', onRetry: () {})]),
          SizedBox(height: 40.h),
        ]),
      );
}
