import 'package:driver_app/config/routes/routes.dart';
import 'package:flutter_test/flutter_test.dart';
import 'helpers/pump_app.dart';

void main() {
  testWidgets('route and student views omit saved stop timings', (tester) async {
    await setUpTestApp(signedInAs: 'crw_001');
    await pumpApp(tester, location: RoutePaths.stops);
    expect(find.text('Sector 14 Market'), findsOneWidget);
    expect(find.textContaining('06:45'), findsNothing);
    expect(find.textContaining('15:40'), findsNothing);
    await tapVisible(tester, find.text('Aarav Sharma').first);
    await settle(tester);
    expect(find.text('Stop'), findsOneWidget);
    expect(find.text('Pickup / Drop'), findsNothing);
    expect(find.textContaining('06:45'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
