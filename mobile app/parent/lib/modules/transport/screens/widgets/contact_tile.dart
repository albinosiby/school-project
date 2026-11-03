import 'package:flutter/material.dart';
import '../../../../core/widgets/phone_call.dart';
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

/// Confirm in a sheet, then open the dialer (`tel:` through LinkLauncher).
Future<void> confirmCall(BuildContext context, BusContact c) async {
  if (c.phone.trim().isEmpty) {
    AppDialogs.showSnackBar(
      context,
      message: 'No phone number on record for ${c.name.isEmpty ? c.role : c.name}',
    );
    return;
  }
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
  if (ok == true && context.mounted) await callPhone(context, c.name, c.phone);
}
