import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../../../utils/services/link_launcher.dart';
import '../../bloc/live_classes_bloc.dart';
import '../../bloc/live_classes_events.dart';
import '../../models/live_class_models.dart';
import '../../models/live_class_rules.dart';
import 'engage_widgets.dart';

bool isMeet(LiveSession e) => e.medium == 'Google Meet';

/// Opens the Meet link outside the app and records the join. If nothing can open it, shows the link with a copy action.
Future<void> joinMeet(BuildContext context, LiveSession e) async {
  final link = normalizeMeetLink(e.link) ?? e.link;
  context.read<LiveClassesBloc>().add(LiveSessionJoinOpened(e.id));
  final ok = link.isNotEmpty && await launchExternal(Uri.parse(link));
  if (!ok && context.mounted) await showLinkFallback(context, link);
}

Future<void> showLinkFallback(BuildContext context, String link) => showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.xl)), backgroundColor: C.bg,
        title: Text("Couldn't open Google Meet", style: T.h2),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Copy the link and open it in Google Meet or your browser.', style: T.body),
          SizedBox(height: 10.h),
          Container(
            width: double.infinity, padding: EdgeInsets.all(10.r),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
            child: SelectableText(link.isEmpty ? 'No link set for this class' : link, style: T.bodyStrong.copyWith(color: C.primary)),
          ),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Close', style: T.bodyStrong.copyWith(color: C.slate))),
          if (link.isNotEmpty)
            TextButton(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: link));
                if (ctx.mounted) Navigator.pop(ctx);
                if (context.mounted) showNotice(context, 'Link copied');
              },
              child: Text('Copy link', style: T.bodyStrong.copyWith(color: C.primary)),
            ),
        ],
      ),
    );

/// Shares title, class, time and Meet link through WhatsApp (`wa.me`); falls back to copying the message.
Future<void> shareToWhatsApp(BuildContext context, LiveSession e, {required String className}) async {
  final when = '${fmtDay(e.date)}, ${fmtDate(e.date)} • ${fmtTime(e.time)} – ${fmtTime(addMins(e.time, e.mins))}';
  final text = shareMessage(e, className: className, when: when);
  final ok = await launchExternal(whatsappShareUri(text));
  if (ok || !context.mounted) return;
  await Clipboard.setData(ClipboardData(text: text));
  if (context.mounted) showNotice(context, 'WhatsApp not available. Message copied to share manually');
}

/// "N joined" caption with the honest note that this counts link opens.
class JoinedCount extends StatelessWidget {
  const JoinedCount(this.count, {super.key});
  final int count;
  @override
  Widget build(BuildContext context) => Row(children: [
        Icon(Icons.how_to_reg_outlined, size: 16.r, color: C.slate), SizedBox(width: 6.w),
        Expanded(child: Text('$count joined • counts link opens, not attendance', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis)),
      ]);
}
