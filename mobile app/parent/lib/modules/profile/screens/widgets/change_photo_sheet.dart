import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/guardian_profile.dart';
import 'guardian_avatar.dart';

/// Result of "6.1.1 Change Profile Picture": the new photo style, or [removed].
class PhotoChoice {
  const PhotoChoice(this.style);
  const PhotoChoice.removed() : style = null;
  final int? style;
}

/// Figma 6.1.1 popup. Camera and gallery are simulated: the camera "takes" the next photo style,
/// the gallery lets the guardian pick one of the styles. Returns null when cancelled.
Future<PhotoChoice?> showChangePhotoSheet(
  BuildContext context, {
  required String name,
  required int? current,
}) => showAppSheet<PhotoChoice>(
  context,
  title: 'Update profile picture',
  subtitle: 'Choose how you\'d like to update your guardian profile photo',
  builder: (ctx) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _Option(
        key: const ValueKey('photo-camera'),
        icon: Icons.photo_camera_outlined,
        title: 'Take photo',
        caption: 'Use device camera for instant capture',
        onTap: () => Navigator.pop(
          ctx,
          PhotoChoice(((current ?? -1) + 1) % photoStyleCount),
        ),
      ),
      _Option(
        key: const ValueKey('photo-gallery'),
        icon: Icons.photo_library_outlined,
        title: 'Upload from gallery',
        caption: 'Choose an existing photo from library',
        onTap: () async {
          final style = await _pickFromGallery(ctx, name, current);
          if (style != null && ctx.mounted) Navigator.pop(ctx, PhotoChoice(style));
        },
      ),
      if (current != null)
        _Option(
          key: const ValueKey('photo-remove'),
          icon: Icons.delete_outline_rounded,
          title: 'Remove photo',
          caption: 'Show your initials instead',
          tone: Tone.danger,
          onTap: () => Navigator.pop(ctx, const PhotoChoice.removed()),
        ),
      SizedBox(height: 8.h),
      AppButton('Cancel', kind: BtnKind.soft, onPressed: () => Navigator.pop(ctx)),
    ],
  ),
);

Future<int?> _pickFromGallery(BuildContext context, String name, int? current) =>
    showAppSheet<int>(
      context,
      title: 'Choose a photo',
      subtitle: 'Recent photos',
      builder: (ctx) => Wrap(
        spacing: 14.w,
        runSpacing: 14.h,
        children: [
          for (var i = 0; i < photoStyleCount; i++)
            Semantics(
              button: true,
              selected: i == current,
              label: 'Photo ${i + 1}',
              child: InkWell(
                key: ValueKey('gallery-photo-$i'),
                customBorder: const CircleBorder(),
                onTap: () => Navigator.pop(ctx, i),
                child: Container(
                  padding: EdgeInsets.all(3.r),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: i == current ? C.primary : Colors.transparent,
                      width: 2,
                    ),
                  ),
                  child: Avatar(name, size: 56, tone: photoTone(i)),
                ),
              ),
            ),
        ],
      ),
    );

class _Option extends StatelessWidget {
  const _Option({
    super.key,
    required this.icon,
    required this.title,
    required this.caption,
    required this.onTap,
    this.tone = Tone.brand,
  });
  final IconData icon;
  final String title, caption;
  final VoidCallback onTap;
  final Tone tone;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: title,
    excludeSemantics: true,
    child: InkWell(
      borderRadius: BorderRadius.circular(R.lg),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 10.h),
        child: Row(
          children: [
            IconTile(icon, tone: tone, size: 44),
            SizedBox(width: 14.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: T.bodyStrong.copyWith(fontSize: 15.sp)),
                  Text(caption, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: C.slate, size: 24.r),
          ],
        ),
      ),
    ),
  );
}
