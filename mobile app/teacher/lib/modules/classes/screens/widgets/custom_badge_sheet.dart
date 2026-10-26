import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/classes_models.dart';
import 'classes_ui.dart';

/// Figma 1153:11985 "3.1.1.2 Custom Badge Popup". Returns the new (unsaved) badge or null.
Future<BehaviourBadge?> showCustomBadgeSheet(BuildContext context, {required String className}) =>
    showAppSheet<BehaviourBadge>(context, title: 'Create Custom Badge', builder: (ctx) => _BadgeForm(className: className));

class _BadgeForm extends StatefulWidget {
  const _BadgeForm({required this.className});
  final String className;
  @override
  State<_BadgeForm> createState() => _BadgeFormState();
}

class _BadgeFormState extends State<_BadgeForm> {
  final _name = TextEditingController();
  String _cat = praiseCategories.first;
  String _icon = 'trophy';
  String _theme = badgeThemes.keys.first;
  int _merits = 5;
  String? _err;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _create() {
    final n = _name.text.trim();
    if (n.isEmpty) {
      setState(() => _err = 'Enter a badge name');
      return;
    }
    Navigator.pop(context, BehaviourBadge(name: n, kind: 'praise', category: _cat, icon: _icon, theme: _theme, merits: _merits, custom: true));
  }

  @override
  Widget build(BuildContext context) {
    final tone = toneColors(badgeTone(_theme));
    final name = _name.text.trim().isEmpty ? 'Badge name' : _name.text.trim();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        padding: EdgeInsets.all(14.r),
        decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.panelBorder)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text('LIVE BADGE PREVIEW', style: T.capsMuted)), const Pill('Instant sync', dot: true)]),
          SizedBox(height: 10.h),
          Row(children: [
            Container(width: 48.r, height: 48.r, decoration: BoxDecoration(color: tone.bg, shape: BoxShape.circle), child: Icon(badgeIcon(_icon), color: tone.fg, size: 24.r)),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text('$_cat • Class ${widget.className} • +$_merits Merits', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ]),
            ),
          ]),
        ]),
      ),
      SizedBox(height: 14.h),
      Row(children: [Expanded(child: Text('Badge Name / Title', style: T.smallStrong.copyWith(color: C.slate))), Text('${_name.text.length} / 30', style: T.small)]),
      SizedBox(height: 6.h),
      TextField(
        controller: _name, maxLength: 30, onChanged: (_) => setState(() => _err = null),
        decoration: InputDecoration(hintText: 'e.g. Inquisitive Thinker', counterText: '', errorText: _err),
      ),
      SizedBox(height: 14.h),
      Text('Praise Category', style: T.smallStrong.copyWith(color: C.slate)),
      SizedBox(height: 6.h),
      AppChoiceChips(items: praiseCategories, value: _cat, onChanged: (v) => setState(() => _cat = v)),
      SizedBox(height: 14.h),
      Row(children: [Expanded(child: Text('Choose Icon', style: T.smallStrong.copyWith(color: C.slate))), Text('8 curated symbols', style: T.small)]),
      SizedBox(height: 6.h),
      LayoutBuilder(builder: (ctx, cs) {
        final w = (cs.maxWidth - 3 * 8.w) / 4;
        return Wrap(spacing: 8.w, runSpacing: 8.h, children: [
          for (final e in badgeIcons.entries)
            Semantics(
              label: e.value.$2, button: true, selected: _icon == e.key,
              child: InkWell(
                borderRadius: BorderRadius.circular(R.md),
                onTap: () => setState(() => _icon = e.key),
                child: Container(
                  width: w, height: 56.h,
                  decoration: BoxDecoration(
                    color: _icon == e.key ? C.primarySoft : C.bg, borderRadius: BorderRadius.circular(R.md),
                    border: Border.all(color: _icon == e.key ? C.primary : C.border),
                  ),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(e.value.$1, size: 20.r, color: _icon == e.key ? C.primary : C.slate),
                    Text(e.value.$2, style: T.small.copyWith(fontSize: 9.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
              ),
            ),
        ]);
      }),
      SizedBox(height: 14.h),
      AppDropdown<String>(label: 'Badge Theme Color', value: _theme, items: badgeThemes.keys.toList(), onChanged: (v) => setState(() => _theme = v)),
      Row(children: [Expanded(child: Text('Default Merits Awarded', style: T.smallStrong.copyWith(color: C.slate))), Text('Boosts student score', style: T.small)]),
      SizedBox(height: 6.h),
      AppChoiceChips(
        items: const ['+2 Merits', '+5 Merits', '+10 Merits', '+15 Merits'], value: '+$_merits Merits',
        onChanged: (v) => setState(() => _merits = int.parse(v.replaceAll(RegExp(r'\D'), ''))),
      ),
      SizedBox(height: 20.h),
      Row(children: [
        Expanded(child: AppButton('Cancel', kind: BtnKind.outline, onPressed: () => Navigator.pop(context))),
        SizedBox(width: 10.w),
        Expanded(flex: 2, child: AppButton('Create & Apply Badge', onPressed: _create)),
      ]),
    ]);
  }
}
