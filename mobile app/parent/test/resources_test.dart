import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/modules/resources/models/resource_models.dart';
import 'package:parent_app/modules/resources/repositories/mock_resource_repository.dart';

import 'helpers/pump_app.dart';

String _location(WidgetTester tester) => GoRouter.of(tester.element(find.byType(Navigator).first)).routerDelegate.currentConfiguration.uri.toString();

Finder _keyPrefix(String prefix) => find.byWidgetPredicate(
  (w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith(prefix),
);

void main() {
  group('resource model', () {
    test('YouTube ids from every link shape', () {
      expect(youtubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
      expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s'), 'dQw4w9WgXcQ');
      expect(youtubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
      expect(youtubeId('https://youtube.com/shorts/abcDEF12345'), 'abcDEF12345');
      expect(youtubeId('https://www.youtube.com/embed/abcDEF12345'), 'abcDEF12345');
      expect(youtubeId('https://www.youtube.com/live/abcDEF12345?si=x'), 'abcDEF12345');
      expect(youtubeId('https://vimeo.com/12345'), isNull);
      expect(youtubeId('https://www.youtube.com/channel/UC123'), isNull);
      expect(youtubeId('not a url'), isNull);
    });

    test('docs: only parents-visible with a URL; types and thumbnail', () {
      final video = ClassResource.fromDoc('a', {'kind': 'youtube', 'title': 'V', 'url': 'https://youtu.be/dQw4w9WgXcQ', 'visibility': 'parents'})!;
      expect(video.thumbnail, 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(video.type, 'video');
      // a YouTube URL saved as a plain link still plays as a video
      expect(ClassResource.fromDoc('b', {'kind': 'link', 'url': 'https://youtu.be/dQw4w9WgXcQ', 'visibility': 'parents'})!.kind, ResourceKind.youtube);
      expect(ClassResource.fromDoc('c', {'kind': 'link', 'url': 'https://drive.google.com/file/d/x', 'visibility': 'parents'})!.type, 'drive');
      expect(ClassResource.fromDoc('d', {'kind': 'file', 'url': 'https://x/a', 'fileName': 'notes.docx', 'visibility': 'parents'})!.type, 'word');
      expect(ClassResource.fromDoc('e', {'kind': 'file', 'url': 'https://x/a', 'mime': 'application/pdf', 'sizeBytes': 2097152, 'visibility': 'parents'})!.sizeLabel, '2.0 MB');
      expect(ClassResource.fromDoc('f', {'kind': 'file', 'url': 'https://x/a.pptx', 'visibility': 'parents'})!.type, 'slides');
      expect(ClassResource.fromDoc('g', {'kind': 'file', 'url': 'https://x/a', 'visibility': 'private'}), isNull);
      expect(ClassResource.fromDoc('h', {'kind': 'file', 'url': '', 'visibility': 'parents'}), isNull);
      expect(ClassResource.fromDoc('i', {'kind': 'file', 'url': 'https://x/a', 'visibility': 'parents', 'deleted': true}), isNull);
    });

    test('pinned first, then newest', () {
      final list = ClassResource.sorted([
        ClassResource(id: 'old', title: 'o', kind: ResourceKind.link, url: 'https://x', createdAt: DateTime(2026, 11, 1)),
        ClassResource(id: 'pin', title: 'p', kind: ResourceKind.link, url: 'https://x', pinned: true, createdAt: DateTime(2026, 10, 1)),
        ClassResource(id: 'new', title: 'n', kind: ResourceKind.link, url: 'https://x', createdAt: DateTime(2026, 11, 20)),
      ]);
      expect(list.map((r) => r.id), ['pin', 'new', 'old']);
    });

    test('demo repository hides private resources', () async {
      final list = await MockResourceRepository().watchResources('stu_1').first;
      expect(list.map((r) => r.id), isNot(contains('r5')));
      expect(list.first.id, 'r2', reason: 'pinned first');
      expect(list.length, 4);
    });
  });

  group('Resources section', () {
    setUp(() async => setUpTestApp(signedIn: true));

    testWidgets('lists the shared resources and filters by type', (tester) async {
      await pumpApp(tester, location: RoutePaths.academicsSection('resources'));
      expect(_location(tester), RoutePaths.academicsSection('resources'));
      expect(find.byKey(const Key('resource-filters')), findsOneWidget);
      expect(find.text('Shared by teachers'), findsOneWidget);
      expect(find.byKey(const Key('resource-r2')), findsOneWidget);
      expect(find.byKey(const Key('thumb-r1')), findsOneWidget, reason: 'YouTube thumbnail');
      await tester.ensureVisible(find.text('Videos (1)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Videos (1)'));
      await tester.pumpAndSettle();
      expect(_keyPrefix('resource-r').evaluate().length, 1);
      expect(find.byKey(const Key('resource-r1')), findsOneWidget);
      await tester.ensureVisible(find.text('Links (1)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Links (1)'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('resource-r4')), findsOneWidget);
      await tester.ensureVisible(find.text('Files (2)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Files (2)'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('resource-r2')), findsOneWidget);
      expect(find.byKey(const Key('resource-r3')), findsOneWidget);
    });

    testWidgets('the Resources segment switches the section', (tester) async {
      await pumpApp(tester, location: RoutePaths.academics);
      await tester.tap(find.descendant(of: find.byKey(const Key('academics-sections')), matching: find.text('Resources')));
      await tester.pumpAndSettle();
      expect(_location(tester), RoutePaths.academicsSection('resources'));
    });
  });
}
