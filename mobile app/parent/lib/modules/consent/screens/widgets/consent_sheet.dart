import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../bloc/consent_bloc.dart';

/// The consent form (first sign-in, and Settings > Privacy). Data processing is required; photos and notifications are optional.
class ConsentForm extends StatefulWidget {
  const ConsentForm({
    super.key,
    this.initial,
    required this.onSubmit,
    this.submitLabel = 'I agree',
  });
  final ConsentRecord? initial;
  final void Function(bool photos, bool notifications) onSubmit;
  final String submitLabel;
  @override
  State<ConsentForm> createState() => _ConsentFormState();
}

class _ConsentFormState extends State<ConsentForm> {
  late bool _photos = widget.initial?.photos ?? false;
  late bool _notifications = widget.initial?.notifications ?? true;

  @override
  Widget build(BuildContext context) {
    final saving = context.select<ConsentBloc, bool>((b) => b.state.saving);
    final error = context.select<ConsentBloc, String?>((b) => b.state.error);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppSwitchTile(
          key: const Key('consent-data'),
          title: "Process my child's school records (required)",
          subtitle:
              'Attendance, homework, results, fees and transport, shared only with the school.',
          value: true,
          onChanged: (_) {},
        ),
        AppSwitchTile(
          key: const Key('consent-photos'),
          title: 'Photos in school media (optional)',
          subtitle:
              'Event photos on notice boards, the website and the yearbook.',
          value: _photos,
          onChanged: (v) => setState(() => _photos = v),
        ),
        AppSwitchTile(
          key: const Key('consent-notifications'),
          title: 'App notifications (optional)',
          subtitle:
              'Absence, bus, homework, results and fee alerts on this phone.',
          value: _notifications,
          onChanged: (v) => setState(() => _notifications = v),
        ),
        if (error != null)
          Padding(
            padding: EdgeInsets.only(top: 8.h),
            child: Text(error, style: T.small.copyWith(color: C.danger)),
          ),
        SizedBox(height: 12.h),
        AppButton(
          widget.submitLabel,
          key: const Key('consent-submit'),
          busy: saving,
          onPressed: saving
              ? null
              : () => widget.onSubmit(_photos, _notifications),
        ),
      ],
    );
  }
}

/// Asks once per app session when no current consent is recorded (contract 13.3: written at first sign-in).
class ConsentGate extends StatefulWidget {
  const ConsentGate({super.key, required this.child});
  final Widget child;
  @override
  State<ConsentGate> createState() => _ConsentGateState();
}

class _ConsentGateState extends State<ConsentGate> {
  bool _asked = false;

  @override
  Widget build(BuildContext context) => BlocListener<ConsentBloc, ConsentState>(
    listenWhen: (a, b) => b.needsConsent && !_asked,
    listener: (context, s) async {
      _asked = true;
      final bloc = context.read<ConsentBloc>();
      await showModalBottomSheet<void>(
        context: context,
        useRootNavigator: true,
        isDismissible: false,
        enableDrag: false,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: C.bg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(R.xxl)),
        ),
        builder: (ctx) => BlocProvider.value(
          value: bloc,
          child: BlocListener<ConsentBloc, ConsentState>(
            listenWhen: (a, b) => a.saving && !b.saving && b.error == null,
            listener: (_, _) => Navigator.of(ctx).pop(),
            child: Padding(
              padding: EdgeInsets.fromLTRB(20.w, 20.h, 20.w, 20.h),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Your consent', style: T.h1),
                    SizedBox(height: 6.h),
                    Text(
                      'The school needs your consent to share your child\'s records with you in this app. You can change the optional items later in Settings > Privacy.',
                      style: T.body,
                    ),
                    SizedBox(height: 12.h),
                    ConsentForm(
                      initial: s.record,
                      onSubmit: (p, n) =>
                          bloc.add(SaveConsent(photos: p, notifications: n)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
    child: widget.child,
  );
}
