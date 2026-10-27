import 'dart:async';
import '../../family/models/family_models.dart';
import '../../family/repositories/family_repository_interface.dart';
import 'profile_repository_interface.dart';

/// Decorates the family repository so a saved profile replaces the guardian in the family stream:
/// FamilyBloc (header, home greeting, child switcher) updates without the family module knowing about profiles.
class ProfileFamilyRepository implements IFamilyRepository {
  ProfileFamilyRepository(this._inner, this._profiles);
  final IFamilyRepository _inner;
  final IProfileRepository _profiles;

  @override
  Stream<Family> watchFamily() {
    late final StreamController<Family> out;
    StreamSubscription<Family>? familySub;
    StreamSubscription<Guardian>? guardianSub;
    Family? family;
    Guardian? guardian;

    void push() {
      final f = family;
      if (f == null) return;
      final g = guardian;
      out.add(
        g == null || g.id != f.guardian.id
            ? f
            : Family(guardian: g, children: f.children),
      );
    }

    out = StreamController<Family>(
      onListen: () {
        familySub = _inner.watchFamily().listen((f) {
          family = f;
          push();
        }, onError: out.addError);
        guardianSub = _profiles
            .watchProfile()
            .map((p) => p.guardian)
            .distinct()
            .listen((g) {
              guardian = g;
              push();
            }, onError: (_) {});
      },
      // Not awaited: cache-first streams parked in `await for` complete their cancel only on the next event.
      onCancel: () {
        familySub?.cancel();
        guardianSub?.cancel();
      },
    );
    return out.stream;
  }
}
