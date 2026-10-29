import 'package:equatable/equatable.dart';

/// Immutable, provider-independent presentation contract shared by the features.
class ViewNode {
  const ViewNode({
    required this.id,
    required this.name,
    required this.x,
    required this.y,
    required this.width,
    required this.height,
    this.children = const [],
    this.text,
    this.textRuns = const [],
    this.asset,
    this.binding,
    this.semanticLabel,
    this.assetWidth,
    this.assetHeight,
    this.assetOffsetX = 0,
    this.assetOffsetY = 0,
    this.align = "LEFT",
    this.verticalAlign = "TOP",
    this.letterSpacing = 0,
    this.clips = false,
    this.fill,
    this.stroke,
    this.radius = 0,
    this.fontSize = 14,
    this.fontWeight = 400,
    this.color,
    this.lineHeight,
    this.action,
    this.input = false,
    this.inputHint,
    this.fieldPadding = const [10, 8, 10, 8],
    this.multiline = false,
    this.scroll = false,
    this.opacity = 1,
    this.gradient = const [],
    this.shadows = const [],
  });
  final String id, name, align, verticalAlign;
  final double x, y, width, height, radius, fontSize, opacity;
  final int fontWeight;
  final double assetOffsetX, assetOffsetY, letterSpacing;
  final bool clips;
  final String? text,
      asset,
      fill,
      stroke,
      color,
      action,
      binding,
      semanticLabel;
  final double? lineHeight, assetWidth, assetHeight;
  final bool input, multiline, scroll;
  final String? inputHint;
  final List<double> fieldPadding;
  final List<ViewNode> children;
  final List<ViewTextRun> textRuns;
  final List<String> gradient;
  final List<ViewShadow> shadows;
}

class ScreenModel extends Equatable {
  const ScreenModel({
    required this.id,
    required this.title,
    required this.role,
    required this.feature,
    required this.root,
    required this.modal,
    this.initialValues = const {},
  });
  final String id, title, role, feature;
  final ViewNode root;
  final bool modal;
  final Map<String, String> initialValues;
  @override
  List<Object?> get props => [id, role];
}

class ViewState extends Equatable {
  const ViewState({
    this.screen,
    this.loading = true,
    this.error,
    this.values = const {},
    this.selected = const {},
    this.effect,
    this.revision = 0,
  });
  final ScreenModel? screen;
  final bool loading;
  final String? error;
  final Map<String, String> values;
  final Set<String> selected;
  final ViewEffect? effect;
  final int revision;
  ViewState copy({
    ScreenModel? screen,
    bool? loading,
    String? error,
    Map<String, String>? values,
    Set<String>? selected,
    ViewEffect? effect,
  }) => ViewState(
    screen: screen ?? this.screen,
    loading: loading ?? this.loading,
    error: error,
    values: values ?? this.values,
    selected: selected ?? this.selected,
    effect: effect,
    revision: revision + 1,
  );
  @override
  List<Object?> get props => [
    screen,
    loading,
    error,
    values,
    selected,
    effect,
    revision,
  ];
}

sealed class ViewEffect {
  const ViewEffect();
}

class NavigateTo extends ViewEffect {
  const NavigateTo(this.id);
  final String id;
}

class ShowMessage extends ViewEffect {
  const ShowMessage(this.message);
  final String message;
}

class CloseView extends ViewEffect {
  const CloseView();
}

class ViewShadow {
  const ViewShadow(this.color, this.dx, this.dy, this.blur, this.spread);
  final String color;
  final double dx, dy, blur, spread;
}

/// Style ranges preserve emphasis within one native, accessible text widget.
class ViewTextRun {
  const ViewTextRun({
    required this.text,
    required this.size,
    required this.weight,
    required this.color,
    required this.spacing,
  });
  final String text, color;
  final double size, spacing;
  final int weight;
}
