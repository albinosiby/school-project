import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/transport_models.dart';

/// Driver / attendant row: initials tile, name (+ rating), detail line and a round call button.
class ContactTile extends StatelessWidget {
  const ContactTile({
    super.key,
    required this.contact,
    required this.detail,
    required this.onCall,
  });
  final BusContact contact;
  final String detail;
  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Avatar(contact.name, size: 42, tone: Tone.neutral),
      SizedBox(width: 12.w),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Flexible(
                  child: Text(
                    contact.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.bodyStrong.copyWith(color: C.onSurface),
                  ),
                ),
                if (contact.rating != null) ...[
                  SizedBox(width: 6.w),
                  Text(
                    '★ ${contact.rating}',
                    style: T.smallStrong.copyWith(color: C.amber),
                  ),
                ],
              ],
            ),
            Text(
              detail,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: T.small.copyWith(color: C.onSurfaceVariant),
            ),
          ],
        ),
      ),
      Tooltip(
        message: 'Call ${contact.name}',
        child: Semantics(
          button: true,
          label: 'Call ${contact.name}',
          child: Material(
            color: C.primary,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onCall,
              child: SizedBox(
                width: 44.r,
                height: 44.r,
                child: Icon(
                  Icons.call_rounded,
                  size: 18.r,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ),
      ),
    ],
  );
}

/// Simulated call: confirm in a sheet, then a snackbar (no telephony in the demo).
Future<void> confirmCall(BuildContext context, BusContact c) async {
  final ok = await showAppSheet<bool>(
    context,
    title: 'Call ${c.name}?',
    subtitle: '${c.role} • ${c.phone}',
    builder: (ctx) => Row(
      children: [
        Expanded(
          child: AppButton(
            'Cancel',
            kind: BtnKind.outline,
            onPressed: () => Navigator.of(ctx).pop(false),
          ),
        ),
        SizedBox(width: 12.w),
        Expanded(
          child: AppButton(
            'Call now',
            icon: Icons.call_rounded,
            onPressed: () => Navigator.of(ctx).pop(true),
          ),
        ),
      ],
    ),
  );
  if (ok == true && context.mounted) {
    AppDialogs.showSnackBar(
      context,
      message: 'Calling ${c.name} (${c.phone})…',
    );
  }
}
