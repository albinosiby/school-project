import 'dart:convert';
import 'package:flutter/services.dart';
import '../models/view_model.dart';

abstract interface class ViewRepository {
  Future<ScreenModel> load(String id);
  Future<void> save(
    String id,
    Map<String, String> values, {
    Set<String> selected = const {},
  });
  void clear();
}

/// Bounded session cache. Parsing and fixture IO stay behind the repository.
class LocalViewRepository implements ViewRepository {
  final Map<String, ScreenModel> _cache = {};
  final Map<String, Map<String, String>> _drafts = {};
  final Map<String, Set<String>> _selectedDrafts = {};
  @override
  Future<ScreenModel> load(String id) async {
    if (_cache.containsKey(id)) return _cache[id]!;
    final raw =
        jsonDecode(await rootBundle.loadString('assets/views/$id.json'))
            as Map<String, dynamic>;
    final screen = ScreenModel(
      id: id,
      title: raw['title'] as String,
      role: raw['role'] as String,
      feature: raw['feature'] as String,
      root: _node(raw['root'] as Map<String, dynamic>),
      modal: raw['modal'] as bool,
      initialSelected: _selectedDrafts[id] ?? const {},
      initialValues: Map<String, String>.from(raw['initialValues'] as Map)
        ..addAll(_drafts[id] ?? {}),
    );
    if (_cache.length >= 64) _cache.remove(_cache.keys.first);
    _cache[id] = screen;
    return screen;
  }

  ViewNode _node(Map<String, dynamic> n) => ViewNode(
    id: n['id'] as String,
    name: n['name'] as String,
    x: (n['x'] as num).toDouble(),
    y: (n['y'] as num).toDouble(),
    width: (n['w'] as num).toDouble(),
    height: (n['h'] as num).toDouble(),
    children: List.unmodifiable(
      (n['children'] as List? ?? []).map(
        (v) => _node(v as Map<String, dynamic>),
      ),
    ),
    text: n['text'] as String?,
    textRuns: List.unmodifiable(
      (n['textRuns'] as List? ?? []).map(
        (r) => ViewTextRun(
          text: r['text'] as String,
          size: (r['size'] as num).toDouble(),
          weight: r['weight'] as int,
          color: r['color'] as String,
          spacing: (r['spacing'] as num).toDouble(),
        ),
      ),
    ),
    binding: n['binding'] as String?,
    semanticLabel: n['semanticLabel'] as String?,
    asset: n['asset'] as String?,
    assetWidth: (n['assetWidth'] as num?)?.toDouble(),
    assetHeight: (n['assetHeight'] as num?)?.toDouble(),
    assetOffsetX: (n['assetOffsetX'] as num? ?? 0).toDouble(),
    assetOffsetY: (n['assetOffsetY'] as num? ?? 0).toDouble(),
    align: n['align'] as String? ?? 'LEFT',
    verticalAlign: n['verticalAlign'] as String? ?? 'TOP',
    letterSpacing: (n['letterSpacing'] as num? ?? 0).toDouble(),
    clips: n['clips'] as bool? ?? false,
    fill: n['fill'] as String?,
    stroke: n['stroke'] as String?,
    radius: (n['radius'] as num? ?? 0).toDouble(),
    fontSize: (n['fontSize'] as num? ?? 14).toDouble(),
    fontWeight: n['fontWeight'] as int? ?? 400,
    color: n['color'] as String?,
    lineHeight: (n['lineHeight'] as num?)?.toDouble(),
    action: n['action'] as String?,
    input: n['input'] as bool? ?? false,
    readOnly: n['readOnly'] as bool? ?? false,
    inputHint: n['inputHint'] as String?,
    interaction: n['interaction'] as String?,
    toggleFor: n['toggleFor'] as String?,
    fieldPadding: (n['fieldPadding'] as List? ?? [10, 8, 10, 8])
        .map((v) => (v as num).toDouble())
        .toList(),
    multiline: n['multiline'] as bool? ?? false,
    scroll: n['scroll'] as bool? ?? false,
    opacity: (n['opacity'] as num? ?? 1).toDouble(),
    gradient: List<String>.from(n['gradient'] as List? ?? []),
    shadows: (n['effects'] as List? ?? [])
        .where((e) => e['type'] == 'DROP_SHADOW')
        .map(
          (e) => ViewShadow(
            e['color'] as String? ?? '#00000010',
            (e['offset']?['x'] as num? ?? 0).toDouble(),
            (e['offset']?['y'] as num? ?? 0).toDouble(),
            (e['blur'] as num? ?? 0).toDouble(),
            (e['spread'] as num? ?? 0).toDouble(),
          ),
        )
        .toList(),
  );
  @override
  Future<void> save(
    String id,
    Map<String, String> values, {
    Set<String> selected = const {},
  }) async {
    _selectedDrafts[id] = Set.unmodifiable(selected);
    _drafts[id] = Map.unmodifiable(values);
    _cache.remove(id);
  }

  @override
  void clear() {
    _cache.clear();
    _drafts.clear();
    _selectedDrafts.clear();
  }
}
