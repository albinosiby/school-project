import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_tone.dart';

/// Wrapping single-select chips (range pickers, sitting status, performance tags).
/// [solid] fills the selected chip with the tone colour (white text); otherwise it uses the soft tone.
/// [toneOf] lets each item pick its tone (e.g. Present = success, Absent = danger).
/// With [deselectable] tapping the selected chip clears it (calls [onChanged] with '').
class AppChoiceChips extends StatelessWidget {
  const AppChoiceChips({super.key, required this.items, required this.value, required this.onChanged, this.solid = false, this.toneOf, this.deselectable = false, this.icons, this.check = false});
  final List<String> items;
  final String value;
  final ValueChanged<String> onChanged;
  final bool solid, deselectable, check;
  final Tone Function(String)? toneOf;
  final Map<String, IconData>? icons;

  @override
  Widget build(BuildContext context) => Wrap(spacing: 8.w, runSpacing: 8.h, children: [
        for (final i in items)
          Builder(builder: (_) {
            final on = i == value;
            final tone = toneOf?.call(i) ?? Tone.brand;
            final c = toneColors(tone);
            final strong = tone == Tone.brand ? C.primary : c.fg;
            final bg = on ? (solid ? strong : c.bg) : C.bg;
            final fg = on ? (solid ? Colors.white : strong) : C.slate;
            return Semantics(
              button: true, selected: on, label: i,
              child: InkWell(
                borderRadius: BorderRadius.circular(R.pill),
                onTap: () => onChanged(on && deselectable ? '' : i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  constraints: BoxConstraints(minHeight: 40.h),
                  padding: EdgeInsets.symmetric(horizontal: 14.w),
                  decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: on ? strong : C.border)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (icons?[i] != null) ...[Icon(icons![i], size: 16.r, color: fg), SizedBox(width: 6.w)],
                    Text(i, style: T.smallStrong.copyWith(fontSize: 13.sp, color: fg)),
                    if (check && on) ...[SizedBox(width: 4.w), Icon(Icons.check_rounded, size: 16.r, color: fg)],
                  ]),
                ),
              ),
            );
          }),
      ]);
}
