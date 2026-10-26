import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/message_models.dart';

/// Badge colour of a contact kind (Figma 4 role tags).
Tone toneOfKind(ContactKind k) => switch (k) {
  ContactKind.classTeacher => Tone.brand,
  ContactKind.subjectTeacher => Tone.warning,
  ContactKind.leadership => Tone.neutral,
  ContactKind.accounts => Tone.success,
  ContactKind.transport => Tone.purple,
};

IconData _officeIcon(ContactKind k) => k == ContactKind.transport
    ? Icons.directions_bus_rounded
    : Icons.account_balance_rounded;

/// People get initials (+ online dot, verified mark); offices get a round icon.
class ContactAvatar extends StatelessWidget {
  const ContactAvatar({
    super.key,
    required this.name,
    required this.kind,
    this.size = 52,
    this.online = false,
    this.verified = false,
  });
  final String name;
  final ContactKind kind;
  final double size;
  final bool online, verified;

  @override
  Widget build(BuildContext context) {
    final tone = toneOfKind(kind);
    if (!kind.isPerson) {
      final c = toneColors(tone);
      return Container(
        width: size.r,
        height: size.r,
        decoration: BoxDecoration(color: c.bg, shape: BoxShape.circle),
        child: Icon(_officeIcon(kind), color: c.fg, size: (size * .46).r),
      );
    }
    return SizedBox(
      width: size.r,
      height: size.r,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Avatar(
            name,
            size: size,
            online: online,
            tone: kind == ContactKind.classTeacher ? Tone.brand : Tone.purple,
          ),
          if (verified && kind == ContactKind.leadership)
            Positioned(
              right: -2,
              bottom: -2,
              child: Icon(
                Icons.shield_rounded,
                size: (size * .3).r,
                color: C.primary,
                semanticLabel: 'School leadership',
              ),
            ),
        ],
      ),
    );
  }
}
