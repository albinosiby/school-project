import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
      final safeBottom = MediaQuery.paddingOf(context).bottom;
      final availableHeight = box.maxHeight - safeBottom;
      final delta = availableHeight - screen.root.height * scale;
      bool header(ViewNode n) => n.y < 120 && n.height < 100;
      bool pinned(ViewNode n) =>
          n.y > screen.root.height * .75 &&
          n.y < screen.root.height &&
          n.height < 160 &&
          !n.scroll;
      final headers = screen.root.children.where(header).toList();
      final footers = screen.root.children.where(pinned).toList();
      final body = screen.root.children
          .where((n) => !header(n) && !pinned(n))
          .toList();
      final top = headers.fold<double>(
        0,
        (v, n) => math.max(v, (n.y + n.height) * scale),
      );
      double footerTop(ViewNode n) => n.y * scale + delta;
      final bottom = footers.fold<double>(
        availableHeight - 16,
        (v, n) => math.min(v, footerTop(n) - 12),
      );
      double extent(ViewNode n) => math.max(
        n.height,
        n.children.fold<double>(0, (v, c) => math.max(v, c.y + c.height)),
      );
      final bodyEnd = body.fold<double>(
        top,
        (v, n) => math.max(v, (n.y + extent(n)) * scale),
      );
      return ColoredBox(
        color: _color(screen.root.fill, const Color(0xFFF7F9FB)),
        child: ClipRect(
          child: SizedBox.expand(
            child: Stack(
              children: [
                Positioned(
                  left: 0,
                  top: top,
                  width: box.maxWidth,
                  height: math.max(1, bottom - top),
                  child: Scrollbar(
                    child: SingleChildScrollView(
                      key: PageStorageKey('${screen.id}/page'),
                      primary: false,
                      physics: const ClampingScrollPhysics(),
                      child: SizedBox(
                        width: box.maxWidth,
                        height: math.max(bottom - top, bodyEnd - top),
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            for (final n in body)
                              Positioned(
                                left: n.x * scale,
                                top: n.y * scale - top,
                                width: n.width * scale,
                                height: extent(n) * scale,
                                child: _node(
                                  context,
                                  n,
                                  scale,
                                  expandViewport: true,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                for (final n in [...headers, ...footers])
                  Positioned(
                    left: n.x * scale,
                    top: header(n) ? n.y * scale : footerTop(n),
                    width: n.width * scale,
                    height: n.height * scale,
                    child: ColoredBox(
                      color: _color(screen.root.fill, const Color(0xFFF7F9FB)),
                      child: _node(context, n, scale),
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
    bool expandViewport = false,
  }) {
    if (n.width <= 0 || n.height <= 0) return const SizedBox.shrink();
    Widget child;
    if (n.toggleFor != null) {
      child = FittedBox(
        child: Checkbox(
          value: selected.contains(n.toggleFor),
          onChanged: (_) => onAction('toggle', n.toggleFor!),
          activeColor: const Color(0xFF2F4FD8),
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      );
    } else if (n.asset != null) {
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
      if (n.children.isNotEmpty) {
        child = Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(child: child),
            for (final hotspot in n.children)
              Positioned(
                left: hotspot.x * s,
                top: hotspot.y * s,
                width: hotspot.width * s,
                height: hotspot.height * s,
                child: _node(context, hotspot, s),
              ),
          ],
        );
      }
    } else if (n.input) {
      child = _ViewInput(
        key: ValueKey('field:${n.id}'),
        node: n,
        scale: s,
        value: values[n.id] ?? n.text ?? '',
        onChanged: onChanged,
        fill: _color(n.fill),
        stroke: n.stroke == null ? null : _color(n.stroke),
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
      final horizontalExtent = n.children.fold<double>(
        n.width,
        (v, c) => math.max(v, c.x + c.width),
      );
      final horizontal =
          horizontalExtent > n.width + 6 && n.height < 140 && n.width > 100;
      final vertical = n.scroll && !expandViewport && !horizontal;
      Widget content = SizedBox(
        width: (horizontal ? horizontalExtent : n.width) * s,
        height: (vertical || expandViewport ? extent : n.height) * s,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            for (final c in n.children)
              Positioned(
                left: c.x * s,
                top: c.y * s,
                width: c.width * s,
                height: c.height * s,
                child: _node(context, c, s),
              ),
          ],
        ),
      );
      if (vertical || horizontal) {
        content = Scrollbar(
          child: SingleChildScrollView(
            key: PageStorageKey('${screen.id}/${n.id}'),
            scrollDirection: horizontal ? Axis.horizontal : Axis.vertical,
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
    if (n.clips && !n.scroll && !expandViewport && n.asset == null) {
      child = ClipRRect(
        borderRadius: BorderRadius.circular(n.radius * s),
        child: child,
      );
    }
    if (n.action != null) {
      final active = selected.contains(n.id);
      child = Semantics(
        key: ValueKey('action:${n.id}'),
        button: true,
        label: n.asset != null || n.children.isEmpty && n.text == null
            ? n.semanticLabel
            : null,
        selected: active,
        checked: n.interaction == 'toggle' ? active : null,
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

class _ViewInput extends StatefulWidget {
  const _ViewInput({
    super.key,
    required this.node,
    required this.scale,
    required this.value,
    required this.onChanged,
    required this.fill,
    required this.stroke,
  });
  final ViewNode node;
  final double scale;
  final String value;
  final Color fill;
  final Color? stroke;
  final void Function(String, String) onChanged;
  @override
  State<_ViewInput> createState() => _ViewInputState();
}

class _ViewInputState extends State<_ViewInput> {
  late final _controller = TextEditingController(text: widget.value);
  @override
  void didUpdateWidget(covariant _ViewInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_controller.text != widget.value) {
      _controller.value = TextEditingValue(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.node;
    final s = widget.scale;
    return TextFormField(
      key: ValueKey(n.id),
      controller: _controller,
      readOnly: n.readOnly,
      inputFormatters: n.width < 60 || (n.inputHint ?? '').contains('OTP')
          ? [FilteringTextInputFormatter.digitsOnly]
          : null,
      onChanged: (v) {
        widget.onChanged(n.id, v);
        if (n.width < 60 && v.length == 1) FocusScope.of(context).nextFocus();
      },
      maxLength: n.width < 60
          ? 1
          : (n.inputHint ?? '').contains('4-digit OTP')
          ? 4
          : null,
      textAlign: n.width < 60 ? TextAlign.center : TextAlign.start,
      textInputAction: n.width < 60
          ? TextInputAction.next
          : TextInputAction.done,
      keyboardType: n.width < 60 || (n.inputHint ?? '').contains('OTP')
          ? TextInputType.number
          : n.multiline
          ? TextInputType.multiline
          : RegExp(r'^\+?[\d\s-]{10,}$').hasMatch(n.text ?? '')
          ? TextInputType.phone
          : RegExp(r'^[\d,.]+$').hasMatch(n.text ?? '')
          ? const TextInputType.numberWithOptions(decimal: true)
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
        fillColor: widget.fill,
        border: InputBorder.none,
        enabledBorder: n.stroke == null
            ? InputBorder.none
            : OutlineInputBorder(
                borderRadius: BorderRadius.circular(n.radius * s),
                borderSide: BorderSide(
                  color: widget.stroke ?? Colors.transparent,
                ),
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
  }
}
