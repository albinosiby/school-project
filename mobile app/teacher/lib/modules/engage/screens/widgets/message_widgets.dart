import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// Tone per recipient kind (parent / staff / student / broadcast).
Tone kindTone(String kind) => switch (kind) { 'parent' => Tone.brand, 'staff' => Tone.purple, 'student' => Tone.success, _ => Tone.neutral };

/// Avatar for a conversation / recipient; broadcast groups get a group icon tile. [size] is in design pixels.
class RecipientAvatar extends StatelessWidget {
  const RecipientAvatar({super.key, required this.name, required this.kind, this.online = false, this.size = 48, this.selected = false});
  final String name, kind;
  final bool online, selected;
  final double size;
  @override
  Widget build(BuildContext context) => kind == 'broadcast'
      ? IconTile(Icons.groups_2_outlined, size: size)
      : Avatar(name, size: size, online: online, tone: selected ? Tone.success : kindTone(kind));
}
