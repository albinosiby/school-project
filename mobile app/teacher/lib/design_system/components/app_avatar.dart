import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_tone.dart';

/// Initials avatar with optional online dot. [size] is in design pixels.
class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 40, this.online = false, this.tone = Tone.brand, this.image});
  final String name;
  /// A `data:image/jpeg;base64,…` photo; initials are drawn when it is missing or unreadable.
  final String? image;
  final double size;
  final bool online;
  final Tone tone;
  Uint8List? get _bytes {
    final v = image;
    if (v == null || !v.startsWith('data:image/')) return null;
    final comma = v.indexOf(',');
    if (comma < 0) return null;
    try {
      return base64Decode(v.substring(comma + 1));
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final parts = name.replaceAll(RegExp(r'^(Mr|Mrs|Ms|Dr)\.?\s+', caseSensitive: false), '').split(RegExp(r'\s+')).where((e) => RegExp(r'^[A-Za-z]').hasMatch(e)).toList();
    final initials = parts.take(2).map((e) => e[0].toUpperCase()).join();
    final c = toneColors(tone);
    final s = size.r;
    return SizedBox(
      width: s, height: s,
      child: Stack(clipBehavior: Clip.none, children: [
        Container(
          width: s, height: s, alignment: Alignment.center, clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: c.bg, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
          child: _bytes == null
              ? Text(initials, style: T.smallStrong.copyWith(color: c.fg, fontSize: s * .36))
              : Image.memory(_bytes!, width: s, height: s, fit: BoxFit.cover, gaplessPlayback: true,
                  errorBuilder: (_, _, _) => Text(initials, style: T.smallStrong.copyWith(color: c.fg, fontSize: s * .36))),
        ),
        if (online)
          Positioned(right: -1, bottom: -1, child: Container(width: s * .3, height: s * .3, decoration: BoxDecoration(color: C.success, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)))),
      ]),
    );
  }
}
