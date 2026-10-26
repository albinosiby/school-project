import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_icon_tile.dart';
import 'app_tone.dart';

/// Grey file row: type icon tile, file name, "size • sub" line and an optional trailing action
/// (view / remove buttons). The icon follows the file extension unless [icon] is given.
class AppFileChip extends StatelessWidget {
  const AppFileChip({
    super.key,
    required this.name,
    this.size,
    this.sub,
    this.trailing,
    this.tone = Tone.danger,
    this.icon,
    this.onTap,
  });
  final String name;
  final String? size, sub;
  final Widget? trailing;
  final Tone tone;
  final IconData? icon;
  final VoidCallback? onTap;

  static IconData iconFor(String name) {
    final n = name.toLowerCase();
    if (n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg'))
      return Icons.image_outlined;
    if (n.endsWith('.doc') || n.endsWith('.docx'))
      return Icons.description_outlined;
    if (n.endsWith('.mp3') || n.endsWith('.m4a'))
      return Icons.audiotrack_outlined;
    return Icons.picture_as_pdf_outlined;
  }

  @override
  Widget build(BuildContext context) {
    final meta = [?size, ?sub].where((e) => e.isNotEmpty).join(' • ');
    return Material(
      color: C.surface,
      borderRadius: BorderRadius.circular(R.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(R.md),
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.fromLTRB(
            10.w,
            8.h,
            trailing == null ? 10.w : 4.w,
            8.h,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(R.md),
            border: Border.all(color: C.border),
          ),
          child: Row(
            children: [
              IconTile(icon ?? iconFor(name), tone: tone, size: 34),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.bodyStrong.copyWith(fontSize: 13.sp),
                    ),
                    if (meta.isNotEmpty)
                      Text(
                        meta,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.small.copyWith(fontSize: 11.sp),
                      ),
                  ],
                ),
              ),
              ?trailing,
            ],
          ),
        ),
      ),
    );
  }
}
