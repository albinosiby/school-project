import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import '../../../../design_system/design_system.dart';

/// Result of a finished recording.
class VoiceClip {
  const VoiceClip({required this.path, required this.duration});
  final String path;
  final Duration duration;
}

/// Records a voice note (AAC in an .m4a file) while showing a live waveform fed by the microphone level.
/// Replaces the composer while active: [onCancel] discards, [onDone] hands back the clip.
class VoiceRecorderBar extends StatefulWidget {
  const VoiceRecorderBar({super.key, required this.onCancel, required this.onDone, this.maxDuration = const Duration(minutes: 3)});
  final VoidCallback onCancel;
  final ValueChanged<VoiceClip> onDone;
  final Duration maxDuration;
  @override
  State<VoiceRecorderBar> createState() => _VoiceRecorderBarState();
}

class _VoiceRecorderBarState extends State<VoiceRecorderBar> with SingleTickerProviderStateMixin {
  final _rec = AudioRecorder();
  final _levels = List<double>.filled(28, 0.05); // rolling microphone levels, newest last
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);
  StreamSubscription<Amplitude>? _amp;
  Timer? _tick;
  Duration _elapsed = Duration.zero;
  String? _path, _error;
  bool _stopping = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      if (!await _rec.hasPermission()) {
        setState(() => _error = 'Microphone permission is needed to record a voice note.');
        return;
      }
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _rec.start(const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 64000, sampleRate: 44100, numChannels: 1), path: path);
      _path = path;
      _amp = _rec.onAmplitudeChanged(const Duration(milliseconds: 90)).listen((a) {
        // dBFS roughly -60 (silence) .. 0 (peak) → 0..1
        final v = ((a.current + 60) / 60).clamp(0.0, 1.0);
        if (!mounted) return;
        setState(() {
          _levels.removeAt(0);
          _levels.add(math.max(0.05, v));
        });
      });
      _tick = Timer.periodic(const Duration(milliseconds: 200), (_) {
        if (!mounted) return;
        setState(() => _elapsed += const Duration(milliseconds: 200));
        if (_elapsed >= widget.maxDuration) _finish();
      });
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not start recording.');
    }
  }

  Future<void> _finish() async {
    if (_stopping) return;
    _stopping = true;
    _tick?.cancel();
    await _amp?.cancel();
    final path = await _rec.stop();
    if (!mounted) return;
    if (path == null || _elapsed < const Duration(milliseconds: 700)) {
      widget.onCancel();
      return;
    }
    widget.onDone(VoiceClip(path: path, duration: _elapsed));
  }

  Future<void> _cancel() async {
    _stopping = true;
    _tick?.cancel();
    await _amp?.cancel();
    final path = await _rec.stop();
    final p = path ?? _path;
    if (p != null) {
      try {
        await File(p).delete();
      } catch (_) {}
    }
    if (mounted) widget.onCancel();
  }

  @override
  void dispose() {
    _tick?.cancel();
    _amp?.cancel();
    _pulse.dispose();
    _rec.dispose();
    super.dispose();
  }

  String get _clock {
    final s = _elapsed.inSeconds;
    return '${(s ~/ 60).toString().padLeft(1, '0')}:${(s % 60).toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Row(children: [
        Icon(Icons.mic_off_rounded, color: C.danger, size: 20.r),
        SizedBox(width: 8.w),
        Expanded(child: Text(_error!, style: T.small.copyWith(color: C.danger))),
        TextButton(onPressed: widget.onCancel, child: const Text('Close')),
      ]);
    }
    return Row(children: [
      // Pulsing red dot + clock.
      AnimatedBuilder(
        animation: _pulse,
        builder: (_, _) => Container(
          width: 12.r,
          height: 12.r,
          decoration: BoxDecoration(
            color: C.danger,
            shape: BoxShape.circle,
            boxShadow: [BoxShadow(color: C.danger.withValues(alpha: .25 + .35 * _pulse.value), blurRadius: 6 + 10 * _pulse.value, spreadRadius: 1 + 3 * _pulse.value)],
          ),
        ),
      ),
      SizedBox(width: 10.w),
      Text(_clock, style: T.bodyStrong.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
      SizedBox(width: 12.w),
      Expanded(
        child: SizedBox(
          height: 40.h,
          child: CustomPaint(painter: _WavePainter(List.of(_levels), color: C.primary)),
        ),
      ),
      SizedBox(width: 8.w),
      IconButton(tooltip: 'Discard recording', onPressed: _cancel, icon: Icon(Icons.delete_outline_rounded, color: C.slate, size: 24.r)),
      Container(
        width: 48.r,
        height: 48.r,
        decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle),
        child: IconButton(tooltip: 'Send voice note', onPressed: _finish, icon: Icon(Icons.send_rounded, size: 20.r, color: Colors.white)),
      ),
    ]);
  }
}

/// Vertical bars, one per level sample, drawn right-aligned so new sound pushes in from the right.
class _WavePainter extends CustomPainter {
  _WavePainter(this.levels, {required this.color});
  final List<double> levels;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final n = levels.length;
    final gap = size.width / n;
    final w = gap * .55;
    final paint = Paint()
      ..color = color
      ..strokeCap = StrokeCap.round
      ..strokeWidth = w;
    for (var i = 0; i < n; i++) {
      final h = math.max(4.0, levels[i] * size.height);
      final x = gap * i + gap / 2;
      final y0 = (size.height - h) / 2;
      canvas.drawLine(Offset(x, y0), Offset(x, y0 + h), paint..color = color.withValues(alpha: .35 + .65 * (i / n)));
    }
  }

  @override
  bool shouldRepaint(_WavePainter old) => true;
}
