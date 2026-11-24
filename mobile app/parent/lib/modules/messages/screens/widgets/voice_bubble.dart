import 'dart:async';
import 'dart:math' as math;
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// Playback of a voice note inside a chat bubble: play / pause, bars that dance while playing,
/// a seekable track and the remaining time. [url] is the attachment's download link.
class VoiceBubble extends StatefulWidget {
  const VoiceBubble({super.key, required this.url, required this.duration, this.mine = false});
  final String url;
  final Duration duration;
  final bool mine;
  @override
  State<VoiceBubble> createState() => _VoiceBubbleState();
}

class _VoiceBubbleState extends State<VoiceBubble> with SingleTickerProviderStateMixin {
  final _player = AudioPlayer();
  late final AnimationController _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));
  final _subs = <StreamSubscription<dynamic>>[];
  Duration _pos = Duration.zero;
  Duration? _total;
  bool _playing = false, _loading = false;
  late final List<double> _shape = List.generate(26, (i) => .25 + .75 * ((math.sin(i * 1.7 + widget.url.hashCode % 7) + 1) / 2));

  @override
  void initState() {
    super.initState();
    _player.setReleaseMode(ReleaseMode.stop);
    _subs.add(_player.onPositionChanged.listen((p) => mounted ? setState(() => _pos = p) : null));
    _subs.add(_player.onDurationChanged.listen((d) => mounted ? setState(() => _total = d) : null));
    _subs.add(_player.onPlayerStateChanged.listen((s) {
      if (!mounted) return;
      final playing = s == PlayerState.playing;
      setState(() {
        _playing = playing;
        _loading = false;
      });
      playing ? _anim.repeat() : _anim.stop();
    }));
    _subs.add(_player.onPlayerComplete.listen((_) {
      if (!mounted) return;
      setState(() {
        _pos = Duration.zero;
        _playing = false;
      });
      _anim.stop();
      _anim.value = 0;
    }));
  }

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    _anim.dispose();
    _player.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_playing) {
      await _player.pause();
      return;
    }
    setState(() => _loading = true);
    try {
      await _player.play(UrlSource(widget.url));
    } catch (_) {
      if (mounted) {
        setState(() => _loading = false);
        AppDialogs.showSnackBar(context, message: 'Could not play this voice note.', isError: true);
      }
    }
  }

  Duration get _len => _total ?? widget.duration;
  String _fmt(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final fg = widget.mine ? Colors.white : C.primary;
    final track = widget.mine ? Colors.white.withValues(alpha: .35) : C.primary.withValues(alpha: .25);
    final progress = _len.inMilliseconds == 0 ? 0.0 : (_pos.inMilliseconds / _len.inMilliseconds).clamp(0.0, 1.0);
    return SizedBox(
      width: 220.w,
      child: Row(children: [
        Semantics(
          button: true,
          label: _playing ? 'Pause voice note' : 'Play voice note',
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: _loading ? null : _toggle,
            child: Container(
              width: 40.r,
              height: 40.r,
              decoration: BoxDecoration(color: widget.mine ? Colors.white.withValues(alpha: .2) : C.primarySoft, shape: BoxShape.circle),
              child: _loading
                  ? Padding(padding: EdgeInsets.all(11.r), child: CircularProgressIndicator(strokeWidth: 2, color: fg))
                  : Icon(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded, color: fg, size: 24.r),
            ),
          ),
        ),
        SizedBox(width: 10.w),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (d) {
                final box = context.findRenderObject() as RenderBox?;
                if (box == null) return;
                final width = box.size.width - 50.w;
                final frac = ((d.localPosition.dx - 50.w) / width).clamp(0.0, 1.0);
                _player.seek(_len * frac);
              },
              child: SizedBox(
                height: 30.h,
                width: double.infinity,
                child: AnimatedBuilder(
                  animation: _anim,
                  builder: (_, _) => CustomPaint(painter: _BarsPainter(_shape, progress: progress, phase: _anim.value, playing: _playing, fg: fg, track: track)),
                ),
              ),
            ),
            SizedBox(height: 2.h),
            Row(children: [
              Icon(Icons.mic_rounded, size: 12.r, color: widget.mine ? Colors.white70 : C.slate),
              SizedBox(width: 4.w),
              Text(_playing || _pos > Duration.zero ? _fmt(_len - _pos) : _fmt(_len), style: T.small.copyWith(fontSize: 11.sp, color: widget.mine ? Colors.white70 : C.slate)),
            ]),
          ]),
        ),
      ]),
    );
  }
}

class _BarsPainter extends CustomPainter {
  _BarsPainter(this.shape, {required this.progress, required this.phase, required this.playing, required this.fg, required this.track});
  final List<double> shape;
  final double progress, phase;
  final bool playing;
  final Color fg, track;
  @override
  void paint(Canvas canvas, Size size) {
    final n = shape.length;
    final gap = size.width / n;
    final paint = Paint()
      ..strokeCap = StrokeCap.round
      ..strokeWidth = gap * .5;
    for (var i = 0; i < n; i++) {
      var level = shape[i];
      if (playing) level = (level * (0.75 + 0.25 * math.sin(phase * 2 * math.pi * 2 - i * .6))).clamp(.15, 1.0);
      final h = math.max(4.0, level * size.height);
      final x = gap * i + gap / 2;
      final y0 = (size.height - h) / 2;
      paint.color = (i / n) <= progress ? fg : track;
      canvas.drawLine(Offset(x, y0), Offset(x, y0 + h), paint);
    }
  }

  @override
  bool shouldRepaint(_BarsPainter old) => old.progress != progress || old.phase != phase || old.playing != playing;
}
