import 'dart:convert';
import 'dart:io';
import 'package:integration_test/integration_test_driver_extended.dart';
Future<void> main()=>integrationDriver(
  writeResponseOnFailure:true,
  onScreenshot:(name,bytes,[args])async{
    final dir=Directory('build/ui_audit/device_screenshots')..createSync(recursive:true);
    await File('${dir.path}/$name.png').writeAsBytes(bytes); return bytes.isNotEmpty;
  },
  responseDataCallback:(data)async{
    final report=Map<String,dynamic>.from(data??{});
    report.remove('screenshots');
    await Directory('build/ui_audit').create(recursive:true);
    await File('build/ui_audit/device_report.json').writeAsString(const JsonEncoder.withIndent('  ').convert(report));
  },
);
