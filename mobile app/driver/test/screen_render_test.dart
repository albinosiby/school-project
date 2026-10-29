import 'helpers/preload_views.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:driver_app/config/routes/routes_config.dart';
import 'package:driver_app/config/routes/view_catalog.dart';
import 'package:driver_app/di/injection.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  setUpAll(() async {
    configureDependencies();
    await preloadViews();
    await GoogleFonts.pendingFonts([
      for (final weight in FontWeight.values.where(
        (w) => w.value >= 200 && w.value <= 800,
      ))
        GoogleFonts.plusJakartaSans(fontWeight: weight),
    ]);
  });
  for (final id in viewCatalog.keys) {
    testWidgets('renders ${viewCatalog[id]!.title}', (tester) async {
      tester.view.physicalSize = const Size(402, 874);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: RepaintBoundary(
              key: const ValueKey('capture'),
              child: featureScreen(id),
            ),
          ),
        ),
      );
      await tester.runAsync(() async {
        await Future<void>.delayed(const Duration(milliseconds: 600));
      });
      await tester.pumpAndSettle(
        const Duration(milliseconds: 100),
        EnginePhase.sendSemanticsUpdate,
        const Duration(seconds: 20),
      );
      expect(tester.takeException(), isNull);
      {
        await tester.runAsync(() async {
          for (final image in tester.widgetList<Image>(find.byType(Image))) {
            await precacheImage(
              image.image,
              tester.element(find.byKey(const ValueKey('capture'))),
            );
          }
          await Future<void>.delayed(const Duration(milliseconds: 600));
        });
        await tester.pumpAndSettle();
        expect(
          tester
              .widgetList<RawImage>(find.byType(RawImage))
              .every((image) => image.image != null),
          isTrue,
          reason: 'Every asset decoded for $id',
        );
        if ([
          '5271',
          '4',
          '7566',
          '7629',
          '7759',
          '1433',
          '2980',
          '8924',
        ].contains(id)) {
          await expectLater(
            find.byKey(const ValueKey('capture')),
            matchesGoldenFile('goldens/$id.png'),
          );
          if (['5271', '1433', '2980', '8924'].contains(id)) {
            final context = tester.element(
              find.byKey(const ValueKey('capture')),
            );
            await tester.pumpWidget(
              MaterialApp(
                home: Scaffold(
                  body: MediaQuery(
                    data: MediaQuery.of(
                      context,
                    ).copyWith(textScaler: const TextScaler.linear(1.15)),
                    child: RepaintBoundary(
                      key: const ValueKey('scaled-capture'),
                      child: featureScreen(id),
                    ),
                  ),
                ),
              ),
            );
            await tester.pumpAndSettle();
            await expectLater(
              find.byKey(const ValueKey('scaled-capture')),
              matchesGoldenFile(
                'goldens/${id == '5271' ? 'home' : id}_text_115.png',
              ),
            );
          }
        }
      }
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }
}
