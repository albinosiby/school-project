import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../models/view_model.dart';

/// Native layout primitives retain the source geometry while remaining editable,
/// focusable, scrollable, and accessible. Images are individual design assets.
class DesignView extends StatelessWidget {
  const DesignView({
    super.key,
    required this.screen,
    required this.values,
    this.bindings = const {},
    required this.selected,
    required this.onAction,
    required this.onChanged,
  });
  final ScreenModel screen;
  final Map<String, String> values;
  final Map<String, String> bindings;
  final Set<String> selected;
  final void Function(String action, String nodeId) onAction;
  final void Function(String id, String value) onChanged;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final scale = box.maxWidth / 402;
      final delta = box.maxHeight - screen.root.height * scale;
      bool pinned(ViewNode n) =>
          n.y > screen.root.height * .75 && n.height < 160 && !n.scroll;
      double top(ViewNode n) => n.y * scale + (pinned(n) ? delta : 0);
      final pinnedTops = screen.root.children.where(pinned).map(top);
      final bottom = pinnedTops.isEmpty
          ? box.maxHeight - 16
          : pinnedTops.reduce(math.min) - 12;
      bool header(ViewNode n) => n.y < 120 && n.height < 100;
      bool needsScroll(ViewNode n) =>
          n.scroll ||
          (n.asset == null &&
              n.text == null &&
              n.children.isNotEmpty &&
              n.height * scale > bottom - top(n) + 6 &&
              n.height > 160);
      final headerBottom = screen.root.children
          .where(header)
          .fold<double>(
            0,
            (edge, n) => math.max(edge, top(n) + n.height * scale),
          );
      double inset(ViewNode n) =>
          needsScroll(n) ? math.max(0, headerBottom - top(n)) : 0;
      final ordered = [
        ...screen.root.children.where((n) => !header(n)),
        ...screen.root.children.where(header),
      ];
      return ColoredBox(
        color: _color(screen.root.fill, const Color(0xFFF7F9FB)),
        child: ClipRect(
          child: SizedBox.expand(
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                for (final child in ordered)
                  Positioned(
                    left: child.x * scale,
                    top: top(child) + inset(child),
                    width: child.width * scale,
                    height: needsScroll(child)
                        ? math.min(
                            child.height * scale,
                            math.max(100, bottom - top(child) - inset(child)),
                          )
                        : child.height * scale,
                    child: header(child)
                        ? ColoredBox(
                            color: _color(
                              screen.root.fill,
                              const Color(0xFFF7F9FB),
                            ),
                            child: _node(context, child, scale),
                          )
                        : _node(
                            context,
                            child,
                            scale,
                            forceScroll: needsScroll(child),
                            scrollInset: inset(child) / scale,
                          ),
                  ),
              ],
            ),
          ),
        ),
      );
    },
  );
  Color _color(String? hex, [Color fallback = Colors.transparent]) {
    if (hex == null) return fallback;
    final v = hex.replaceFirst('#', '');
    if (v.length == 8) {
      return Color(int.parse(v.substring(6, 8) + v.substring(0, 6), radix: 16));
    }
    return v.length == 6 ? Color(int.parse('FF$v', radix: 16)) : fallback;
  }

  TextScaler _fitParagraph(
    BuildContext context,
    ViewNode n,
    double s,
    TextSpan span,
    TextStyle style,
  ) {
    final requested = MediaQuery.textScalerOf(context);
    final fontSize = math.max(1.0, n.fontSize * s);
    final upper = requested.scale(fontSize) / fontSize;
    bool fits(double factor) {
      final painter = TextPainter(
        text: TextSpan(style: style, children: [span]),
        textDirection: Directionality.of(context),
        textScaler: TextScaler.linear(factor),
      )..layout(maxWidth: n.width * s);
      final result = painter.height <= n.height * s + .5;
      painter.dispose();
      return result;
    }

    if (fits(upper)) return requested;
    // Preserve enlarged text wherever the source box has room, then reduce only
    // overflowing paragraphs so instructions and statistics stay within cards.
    double low = .1, high = upper;
    for (var i = 0; i < 9; i++) {
      final middle = (low + high) / 2;
      if (fits(middle)) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return TextScaler.linear(low);
  }

  Widget _node(
    BuildContext context,
    ViewNode n,
    double s, {
    bool forceScroll = false,
    double scrollInset = 0,
  }) {
    if (n.width <= 0 || n.height <= 0) return const SizedBox.shrink();
    Widget child;
    if (n.asset != null) {
      final assetWidth = (n.assetWidth ?? n.width) * s;
      final assetHeight = (n.assetHeight ?? n.height) * s;
      child = OverflowBox(
        minWidth: assetWidth,
        maxWidth: assetWidth,
        minHeight: assetHeight,
        maxHeight: assetHeight,
        child: n.asset!.endsWith('.svg')
            ? SvgPicture.asset(
                n.asset!,
                width: assetWidth,
                height: assetHeight,
                fit: BoxFit.contain,
                excludeFromSemantics: true,
              )
            : Image.asset(
                n.asset!,
                width: assetWidth,
                height: assetHeight,
                fit: BoxFit.contain,
                excludeFromSemantics: true,
              ),
      );
      child = Transform.translate(
        offset: Offset(
          (n.assetOffsetX + (assetWidth / s - n.width) / 2) * s,
          (n.assetOffsetY + (assetHeight / s - n.height) / 2) * s,
        ),
        child: child,
      );
    } else if (n.input) {
      child = TextFormField(
        key: ValueKey(n.id),
        initialValue: values[n.id] ?? n.text ?? '',
        onChanged: (v) {
          onChanged(n.id, v);
          if (n.width < 60 && v.length == 1) FocusScope.of(context).nextFocus();
        },
        maxLength: n.width < 60 ? 1 : null,
        textAlign: n.width < 60 ? TextAlign.center : TextAlign.start,
        textInputAction: n.width < 60
            ? TextInputAction.next
            : TextInputAction.done,
        keyboardType: n.width < 60
            ? TextInputType.number
            : n.multiline
            ? TextInputType.multiline
            : RegExp(r'^\+?[\d\s]+$').hasMatch(n.text ?? '')
            ? TextInputType.phone
            : TextInputType.text,
        maxLines: n.multiline ? null : 1,
        minLines: n.multiline ? 2 : 1,
        style: GoogleFonts.plusJakartaSans(
          fontSize:
              (n.width < 60
                  ? 20
                  : n.multiline
                  ? 12
                  : 14) *
              s,
          color: const Color(0xFF191C1E),
        ),
        decoration: InputDecoration(
          isDense: true,
          contentPadding: EdgeInsets.fromLTRB(
            n.fieldPadding[0] * s,
            n.fieldPadding[1] * s,
            n.fieldPadding[2] * s,
            n.fieldPadding[3] * s,
          ),
          filled: n.fill != null,
          fillColor: _color(n.fill),
          border: InputBorder.none,
          enabledBorder: n.stroke == null
              ? InputBorder.none
              : OutlineInputBorder(
                  borderRadius: BorderRadius.circular(n.radius * s),
                  borderSide: BorderSide(color: _color(n.stroke)),
                ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(math.max(8, n.radius) * s),
            borderSide: const BorderSide(color: Color(0xFF2F4FD8)),
          ),
          hintText:
              n.inputHint ??
              (n.width < 60
                  ? ''
                  : n.multiline
                  ? 'Add your notes…'
                  : 'Enter value'),
          semanticCounterText: n.name,
          counterText: '',
        ),
      );
    } else if (n.text != null) {
      final override = values[n.id] ?? bindings[n.binding];
      final singleLine =
          !n.text!.contains('\n') &&
          n.height < n.fontSize * (n.lineHeight ?? 1.35) * 1.6;
      final style = GoogleFonts.plusJakartaSans(
        fontSize: n.fontSize * s,
        letterSpacing: n.letterSpacing * s,
        fontWeight: FontWeight.values[(n.fontWeight ~/ 100 - 1).clamp(0, 8)],
        height: n.lineHeight ?? 1.35,
        color: _color(n.color, const Color(0xFF191C1E)),
      );
      final span = TextSpan(
        text: override ?? (n.textRuns.isEmpty ? n.text! : null),
        children: override != null || n.textRuns.isEmpty
            ? null
            : [
                for (final run in n.textRuns)
                  TextSpan(
                    text: run.text,
                    style: TextStyle(
                      fontSize: run.size * s,
                      fontWeight: FontWeight
                          .values[(run.weight ~/ 100 - 1).clamp(0, 8)],
                      color: _color(run.color, const Color(0xFF191C1E)),
                      letterSpacing: run.spacing * s,
                    ),
                  ),
              ],
      );
      child = Text.rich(
        span,
        textScaler: singleLine
            ? MediaQuery.textScalerOf(context)
            : _fitParagraph(context, n, s, span, style),
        maxLines: singleLine ? 1 : null,
        softWrap: !singleLine,
        overflow: TextOverflow.visible,
        textAlign: switch (n.align) {
          'CENTER' => TextAlign.center,
          'RIGHT' => TextAlign.right,
          'JUSTIFIED' => TextAlign.justify,
          _ => TextAlign.left,
        },
        style: style,
      );
      if (singleLine) {
        // Compact badges and labels have fixed source bounds. Fit their complete
        // text before an enlarged system font can clip into adjacent controls.
        child = FittedBox(
          fit: BoxFit.scaleDown,
          alignment: switch (n.align) {
            'CENTER' => Alignment.center,
            'RIGHT' => Alignment.centerRight,
            _ => Alignment.centerLeft,
          },
          child: child,
        );
      }
    } else {
      final extent = math.max(
        n.height,
        n.children.fold<double>(0, (v, c) => math.max(v, c.y + c.height)),
      );
      Widget content = SizedBox(
        width: n.width * s,
        height:
            math.max(
              0,
              ((n.scroll || forceScroll) ? extent : n.height) - scrollInset,
            ) *
            s,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            for (final c in n.children)
              Positioned(
                left: c.x * s,
                top: (c.y - scrollInset) * s,
                width: c.width * s,
                height: c.height * s,
                child: _node(context, c, s),
              ),
          ],
        ),
      );
      if (n.scroll || forceScroll) {
        content = Scrollbar(
          child: SingleChildScrollView(
            key: PageStorageKey('${screen.id}/${n.id}'),
            primary: false,
            physics: const ClampingScrollPhysics(),
            child: content,
          ),
        );
      }
      child = DecoratedBox(
        decoration: BoxDecoration(
          color: _color(n.fill),
          gradient: n.gradient.length < 2
              ? null
              : LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: n.gradient.map((c) => _color(c)).toList(),
                ),
          boxShadow: n.fill == null && n.gradient.isEmpty
              ? null
              : n.shadows
                    .map(
                      (e) => BoxShadow(
                        color: _color(e.color),
                        offset: Offset(e.dx * s, e.dy * s),
                        blurRadius: e.blur * s,
                        spreadRadius: e.spread * s,
                      ),
                    )
                    .toList(),
          borderRadius: BorderRadius.circular(n.radius * s),
          border: n.stroke == null
              ? null
              : Border.all(color: _color(n.stroke), width: 1 * s),
        ),
        child: content,
      );
    }
    if (n.clips && !n.scroll && !forceScroll && n.asset == null) {
      child = ClipRRect(
        borderRadius: BorderRadius.circular(n.radius * s),
        child: child,
      );
    }
    if (n.action != null) {
      final active = selected.contains(n.id);
      child = Semantics(
        button: true,
        label: n.asset != null ? n.semanticLabel : null,
        selected: active,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => onAction(n.action!, n.id),
            borderRadius: BorderRadius.circular(n.radius * s),
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: active
                    ? Border.all(color: const Color(0xFF2F4FD8), width: 2)
                    : null,
                borderRadius: BorderRadius.circular(n.radius * s),
              ),
              child: child,
            ),
          ),
        ),
      );
    }
    return n.opacity < 1 ? Opacity(opacity: n.opacity, child: child) : child;
  }
}
