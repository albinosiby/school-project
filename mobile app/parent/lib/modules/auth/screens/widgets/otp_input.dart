import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../design_system/design_system.dart';

/// Six passcode boxes backed by one hidden numeric field, so typing auto-advances and paste works.
class OtpInput extends StatefulWidget {
  const OtpInput({
    super.key,
    required this.controller,
    this.length = 6,
    this.onCompleted,
    this.enabled = true,
    this.hasError = false,
  });
  final TextEditingController controller;
  final int length;
  final ValueChanged<String>? onCompleted;
  final bool enabled, hasError;

  @override
  State<OtpInput> createState() => _OtpInputState();
}

class _OtpInputState extends State<OtpInput> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    _focus.addListener(_changed);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _focus.dispose();
    super.dispose();
  }

  void _changed() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final code = widget.controller.text;
    return Semantics(
      label: 'Passcode, ${code.length} of ${widget.length} digits entered',
      textField: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => _focus.requestFocus(),
        child: Stack(
          children: [
            // The real input: invisible but focusable and testable.
            Positioned.fill(
              child: Opacity(
                opacity: 0,
                child: TextField(
                  key: const Key('otp-field'),
                  controller: widget.controller,
                  focusNode: _focus,
                  enabled: widget.enabled,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  showCursor: false,
                  enableInteractiveSelection: false,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(widget.length),
                  ],
                  onChanged: (v) {
                    if (v.length == widget.length) widget.onCompleted?.call(v);
                  },
                ),
              ),
            ),
            IgnorePointer(
              child: Row(
                children: [
                  for (var i = 0; i < widget.length; i++) ...[
                    if (i > 0) SizedBox(width: 8.w),
                    Expanded(child: _box(code, i)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _box(String code, int i) {
    final filled = i < code.length;
    final active =
        _focus.hasFocus &&
        (i == code.length || (i == widget.length - 1 && filled));
    final border = widget.hasError
        ? C.danger
        : active
        ? C.primary
        : filled
        ? C.primary.withValues(alpha: .5)
        : C.border;
    return AspectRatio(
      aspectRatio: .95,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: filled || active ? C.bg : C.surface,
          borderRadius: BorderRadius.circular(R.md),
          border: Border.all(color: border, width: active ? 1.5 : 1),
        ),
        child: Text(
          filled ? code[i] : '•',
          style: filled
              ? T.h1.copyWith(fontSize: 20.sp)
              : T.h3.copyWith(color: C.muted),
        ),
      ),
    );
  }
}
