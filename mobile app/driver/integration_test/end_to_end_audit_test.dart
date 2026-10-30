import 'dart:ui' as ui;
import 'package:driver_app/core/models/view_model.dart';
import 'package:driver_app/di/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:integration_test/integration_test.dart';
import '../test/helpers/preload_views.dart';
import '../test/support/audit_harness.dart';
import '../test/support/end_to_end_scenarios.dart';

void main(){
  final binding=IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  final observations=<String,String>{};
  final screenshots=<Map<String,dynamic>>[];
  late Map<String,ScreenModel> screens;
  const channel=MethodChannel('shift_sync/ui_audit');
  setUpAll(()async{
    configureDependencies(); await preloadViews(); screens=await loadAuditScreens();
    GoogleFonts.config.allowRuntimeFetching=false;
    await GoogleFonts.pendingFonts([for(final w in FontWeight.values.where((w)=>w.value>=200&&w.value<=800)) GoogleFonts.plusJakartaSans(fontWeight:w)]);
    await channel.invokeMethod<void>('keepScreenOn',true);
    binding.reportData={'observations':observations,'screenshots':screenshots};
  });
  tearDownAll(()async{await channel.invokeMethod<void>('keepScreenOn',false);});
  registerEndToEndScenarios(observe:(key,value)=>observations[key]=value);
  testWidgets('USB audit: every screen and every bound control',(tester)async{
    Future<void> capture(String id,String phase,WidgetTester t)async{
      await t.runAsync(()async{
        for(final img in t.widgetList<Image>(find.byType(Image))) {
          await precacheImage(img.image,t.element(find.byType(MaterialApp)));
        }
      });
      await t.pumpAndSettle();
      final boundary=t.firstRenderObject<RenderObject>(find.byType(MaterialApp));
      RenderObject? current=boundary;
      while(current!=null && current is! RenderRepaintBoundary){current=current.parent;}
      if(current is! RenderRepaintBoundary)throw StateError('No capture boundary');
      final bitmap=await current.toImage(pixelRatio:1);
      final bytes=await bitmap.toByteData(format:ui.ImageByteFormat.png); bitmap.dispose();
      screenshots.add({'screenshotName':'${id}_$phase','bytes':bytes!.buffer.asUint8List().toList()});
    }
    final results=await auditInteractions(tester,screens:screens,capture:capture);
    binding.reportData!['controls']=results;
    binding.reportData!['viewport']={
      'width':tester.view.physicalSize.width/tester.view.devicePixelRatio,
      'height':tester.view.physicalSize.height/tester.view.devicePixelRatio,
      'textScale':tester.platformDispatcher.textScaleFactor,
    };
    final errors=results.where((r)=>['exception','missing','unreachable','input_rejected'].contains(r['result'])).toList();
    expect(errors,isEmpty,reason:'${errors.length} failing controls; see device_report.json');
  },timeout:const Timeout(Duration(minutes:45)));
}
