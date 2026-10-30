import 'package:driver_app/config/routes/routes.dart';
import 'package:driver_app/config/routes/view_catalog.dart';
import 'package:driver_app/core/models/view_model.dart';
import 'package:driver_app/core/repositories/view_repository.dart';
import 'package:driver_app/di/injection.dart';
import 'package:driver_app/main.dart';
import 'package:driver_app/modules/auth/cubit/session_cubit.dart';
import 'package:driver_app/modules/auth/models/auth_models.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:driver_app/modules/transport/repositories/trip_repository.dart';
import '../helpers/preload_views.dart';
import 'package:flutter_test/flutter_test.dart';

Iterable<ViewNode> controls(ViewNode n, {bool insideAction = false}) sync* {
  if (n.input || n.action != null && !insideAction) yield n;
  for (final child in n.children) {
    yield* controls(child, insideAction: insideAction || n.action != null);
  }
}

String nodeLabel(ViewNode n) =>
    n.text ??
    n.semanticLabel ??
    n.children.map(nodeLabel).where((s) => s.isNotEmpty).join(' ');

Future<void> seedRole(String id) async {
  final session = getIt<SessionCubit>();
  await session.requestCode('9876543210');
  await session.verify('482916');
  await session.chooseRole(
    viewCatalog[id]!.role == 'assistant' ? CrewRole.assistant : CrewRole.driver,
  );
}

/// Measures actual pointer reachability, including scrolling and painted overlays.
/// It does not infer business functionality from a successful render or selection.
Future<List<Map<String, Object?>>> auditReachability(
  WidgetTester tester, {
  required Map<String, ScreenModel> screens,
  void Function(String, WidgetTester)? onFrame,
}) async {
  final results = <Map<String, Object?>>[];
  for (final entry in screens.entries) {
    final id = entry.key;
    await seedRole(id);
    await tester.pumpWidget(
      DriverApp(
        key: ValueKey('audit-$id'),
        initialLocation: AppRoutes.path(id),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.byType(CircularProgressIndicator),
      findsNothing,
      reason: 'Loaded $id',
    );
    for (final node in controls(entry.value.root)) {
      final finder = find.byKey(
        ValueKey(node.input ? node.id : 'action:${node.id}'),
      );
      String result = 'reachable';
      String? error;
      if (finder.evaluate().isEmpty) {
        result = 'missing';
      } else {
        try {
          await Scrollable.ensureVisible(
            tester.element(finder.first),
            alignment: .5,
          );
          await tester.pumpAndSettle();
          if (finder.hitTestable().evaluate().isEmpty) {
            result = 'obscured_or_clipped';
          }
        } catch (e) {
          result = 'scroll_error';
          error = e.toString();
        }
      }
      results.add({
        'screen': id,
        'title': entry.value.title,
        'node': node.id,
        'label': nodeLabel(node),
        'action': node.action,
        'input': node.input,
        'result': result,
        'error': ?error,
      });
    }
    expect(tester.takeException(), isNull, reason: 'Reachability $id');
    debugPrint(
      'Reachability $id: ${results.where((r) => r['screen'] == id && r['result'] != 'reachable').length} failures',
    );
    onFrame?.call(id, tester);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  }
  return results;
}

Future<Map<String, ScreenModel>> loadAuditScreens() async {
  final repo = LocalViewRepository();
  return {for (final id in viewCatalog.keys) id: await repo.load(id)};
}

/// Exercises actual onTap callbacks in isolated, authenticated screen sessions.
/// Selection-only responses are reported as previews, never as functional filters.
Future<List<Map<String,Object?>>> auditInteractions(WidgetTester tester, {
  required Map<String,ScreenModel> screens,
  Future<void> Function(String,String,WidgetTester)? capture,
}) async {
  final results=<Map<String,Object?>>[];
  int serial=0;
  Future<void> mount(String id) async {
    await tester.pumpWidget(const SizedBox.shrink()); await tester.pumpAndSettle();
    await seedRole(id); getIt<TripRepository>().clear();
    await tester.runAsync(preloadViews);
    await tester.pumpWidget(DriverApp(key:ValueKey('control-${serial++}'),initialLocation:AppRoutes.path(id)));
    await tester.pumpAndSettle();
  }
  String location() => (tester.widget<MaterialApp>(find.byType(MaterialApp)).routerConfig! as GoRouter)
      .routerDelegate.currentConfiguration.last.matchedLocation;
  List<String> values() => tester.widgetList<TextFormField>(find.byType(TextFormField))
      .map((f)=>f.controller?.text??f.initialValue??'').toList();
  for(final entry in screens.entries) {
    final id=entry.key;
    if(capture!=null) {
      await mount(id); await capture(id,'top',tester);
      final scroll=find.descendant(of:find.byKey(PageStorageKey('$id/page')),matching:find.byType(Scrollable));
      if(scroll.evaluate().isNotEmpty) {
        final p=tester.state<ScrollableState>(scroll.first).position;
        if(p.maxScrollExtent>0) {
          await tester.drag(scroll.first,const Offset(0,-260)); await tester.pumpAndSettle();
          p.jumpTo(p.maxScrollExtent); await tester.pumpAndSettle();
          await capture(id,'bottom',tester);
        }
      }
    }
    for(final node in controls(entry.value.root)) {
      await mount(id);
      final finder=find.byKey(ValueKey(node.input?node.id:'action:${node.id}'));
      final result=<String,Object?>{'screen':id,'title':entry.value.title,'node':node.id,
        'label':nodeLabel(node),'action':node.action,'input':node.input};
      try {
        if(finder.evaluate().isEmpty) { result['result']='missing'; }
        else {
          await Scrollable.ensureVisible(tester.element(finder.first),alignment:.5);
          await tester.pumpAndSettle();
          if(finder.hitTestable().evaluate().isEmpty) { result['result']='unreachable'; }
          else if(node.input) {
            final field=tester.widget<TextFormField>(finder);
            if(field.readOnly) { result['result']='read_only'; }
            else {
              final sample=node.width<60?'1':(node.inputHint??'').contains('OTP')?'1234':
                  RegExp(r'^[\d,.\s+]+$').hasMatch(node.text??'')?'10':'QA audit note';
              await tester.enterText(finder,sample);
              FocusManager.instance.primaryFocus?.unfocus(); await tester.pumpAndSettle();
              result['result']=tester.widget<TextFormField>(finder).controller?.text==sample?'editable':'input_rejected';
            }
          } else {
            final before=location(); final beforeValues=values();
            final beforeRole=getIt<SessionCubit>().state.role;
            final prior=tester.widget<Semantics>(finder).properties.selected;
            await tester.tap(finder); await tester.runAsync(preloadViews); await tester.pumpAndSettle();
            final after=location(); result['destination']=after;
            final messages=tester.widgetList<SnackBar>(find.byType(SnackBar)).map((bar)=>
                bar.content is Text?(bar.content as Text).data??'':bar.content.toString()).toList();
            if(messages.isNotEmpty)result['feedback']=messages.join(' | ');
            if(after!=before) {
              result['result']=node.action=='route:6416'&&after==AppRoutes.path('9783')?'guarded_navigation':'navigation';
            } else if(messages.isNotEmpty) {
              final m=messages.join(' ').toLowerCase();
              result['result']=m.contains('not connected')||m.contains('no external')||m.contains('no sms')||m.contains('no hardware')?
                  'simulated_external':m.contains('saved for this demo session')?'local_draft_saved':
                  m.contains('complete')||m.contains('enter a valid')||m.contains('use demo')||m.contains('request a')?'validation_feedback':'local_feedback';
            } else if(getIt<SessionCubit>().state.role!=beforeRole) { result['result']='role_selection'; }
            else if(values().toString()!=beforeValues.toString()) { result['result']='values_updated'; }
            else if(finder.evaluate().isNotEmpty && tester.widget<Semantics>(finder).properties.selected!=prior) {
              result['result']=node.interaction=='toggle'?'toggle':node.interaction=='choice'?'choice':'preview_selection_only';
            } else if(['profile','notifications'].contains(node.action)) { result['result']='already_at_destination'; }
            else if((node.action??'').contains('Lead Driver')||(node.action??'').contains('Bus Attendant')) {
              result['result']='already_selected_role';
            } else { result['result']='no_response'; }
          }
        }
        final exception=tester.takeException();
        if(exception!=null) {result['result']='exception';result['error']=exception.toString();}
      } catch(e) {result['result']='exception';result['error']=e.toString();}
      results.add(result);
    }
    debugPrint('Interaction audit $id: ${results.where((r)=>r['screen']==id).length} controls');
  }
  await tester.pumpWidget(const SizedBox.shrink()); await tester.pumpAndSettle();
  return results;
}
