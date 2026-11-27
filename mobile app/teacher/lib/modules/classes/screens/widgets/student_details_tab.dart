import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../design_system/design_system.dart';
import '../../bloc/student_profile_bloc.dart';
import '../../bloc/student_profile_events.dart';
import '../../bloc/student_profile_states.dart';
import '../../models/student_details.dart';

/// Class teacher only: the student's full record (personal, contacts, address, medical, admission, transport),
/// with editing for contacts, address and medical notes.
class StudentDetailsTab extends StatelessWidget {
  const StudentDetailsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<StudentProfileBloc>().state;
    final d = s.details;
    if (d == null) {
      if (s.detailsError != null) {
        return Padding(
          padding: EdgeInsets.only(top: 24.h),
          child: AppEmptyState(
            'Could not load the details',
            hint: s.detailsError,
            icon: Icons.cloud_off_rounded,
            action: AppButton('Try again', expand: false, small: true, onPressed: () => context.read<StudentProfileBloc>().add(const StudentDetailsRetried())),
          ),
        );
      }
      return Padding(padding: EdgeInsets.only(top: 12.h), child: const SchoolSkeletonList());
    }
    final age = _age(d.dob);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!d.exists)
          Padding(
            padding: EdgeInsets.only(bottom: 12.h),
            child: _Note(Icons.info_outline_rounded, 'The office has not filled in an admission record for this student yet. What you add here is saved to it.'),
          ),
        _Section(
          title: 'Personal',
          icon: Icons.person_outline_rounded,
          rows: [
            ('Gender', d.gender),
            ('Date of birth', d.dob.isEmpty ? '' : '${_date(d.dob)}${age == null ? '' : ' • $age years'}'),
            ('Nationality', d.nationality),
            ('Mother tongue', d.motherTongue),
            ('Home language', d.language),
            ('Student type', d.studentType),
            if (d.stream.isNotEmpty) ('Stream', d.stream),
          ],
        ),
        _Section(
          title: 'Parents & contacts',
          icon: Icons.family_restroom_rounded,
          onEdit: () => _edit(context, (bloc) => _ContactsForm(d: d, bloc: bloc), 'Parents & contacts'),
          child: Column(
            children: [
              if (d.filledContacts.isEmpty) _Empty('No contacts recorded'),
              for (final (kind, c) in d.filledContacts) _ContactCard(kind: kind, c: c, primary: kind == d.primary, secondary: kind == d.secondary),
              if (d.emergencyPhone.isNotEmpty)
                _ContactCard(kind: 'emergency', c: StudentContact(name: 'Emergency number', phone: d.emergencyPhone), primary: false, secondary: false),
            ],
          ),
        ),
        _Section(
          title: 'Home address',
          icon: Icons.home_outlined,
          onEdit: () => _edit(context, (bloc) => _AddressForm(d: d, bloc: bloc), 'Home address'),
          child: d.homeAddress.isEmpty ? _Empty('No address recorded') : _Text(d.homeAddress),
        ),
        _Section(
          title: 'Health',
          icon: Icons.medical_information_outlined,
          tone: d.conditions.isNotEmpty || d.assistance.isNotEmpty ? Tone.danger : Tone.brand,
          onEdit: () => _edit(context, (bloc) => _MedicalForm(d: d, bloc: bloc), 'Health'),
          rows: [
            ('Blood group', d.bloodGroup),
            ('Medical conditions', d.conditions.isEmpty ? 'None recorded' : d.conditions),
            ('Support needs', d.assistance.isEmpty ? 'None recorded' : d.assistance),
          ],
        ),
        _Section(
          title: 'Admission',
          icon: Icons.badge_outlined,
          rows: [
            ('Admission no.', d.admissionNumber),
            ('Admitted on', d.admissionDate.isEmpty ? '' : _date(d.admissionDate)),
            ('Academic year', d.academicYear),
            ('Admission type', d.admissionType),
            ('Previous school', [d.previousSchool, d.previousClass, d.previousBoard].where((e) => e.isNotEmpty).join(' • ')),
            ('Student email', d.email),
          ],
        ),
        if (d.bus.isNotEmpty || d.busStop.isNotEmpty)
          _Section(
            title: 'Transport',
            icon: Icons.directions_bus_outlined,
            rows: [('Bus', d.bus), ('Stop', d.busStop)],
          ),
        _Note(Icons.lock_outline_rounded, 'Only you as the class teacher see these details. Your changes go to the school office record and are logged.'),
      ],
    );
  }

  Future<void> _edit(BuildContext context, Widget Function(StudentProfileBloc bloc) form, String title) {
    final bloc = context.read<StudentProfileBloc>();
    return showAppSheet<void>(context, title: title, builder: (_) => BlocProvider.value(value: bloc, child: form(bloc)));
  }

  static int? _age(String dob) {
    final d = DateTime.tryParse(dob);
    if (d == null) return null;
    final n = DateTime.now();
    var a = n.year - d.year;
    if (n.month < d.month || (n.month == d.month && n.day < d.day)) a--;
    return a;
  }

  static const _mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  static String _date(String iso) {
    final d = DateTime.tryParse(iso);
    return d == null ? iso : '${d.day} ${_mon[d.month - 1]} ${d.year}';
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.icon, this.rows, this.child, this.onEdit, this.tone = Tone.brand});
  final String title;
  final IconData icon;
  final List<(String, String)>? rows;
  final Widget? child;
  final VoidCallback? onEdit;
  final Tone tone;
  @override
  Widget build(BuildContext context) {
    final shown = [for (final r in rows ?? const <(String, String)>[]) if (r.$2.trim().isNotEmpty) r];
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        radius: R.xl,
        padding: EdgeInsets.fromLTRB(14.w, 12.h, 8.w, 12.h),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                IconTile(icon, tone: tone, size: 32),
                SizedBox(width: 10.w),
                Expanded(child: Text(title, style: T.h3)),
                if (onEdit != null)
                  TextButton.icon(
                    key: ValueKey('edit-$title'),
                    onPressed: onEdit,
                    icon: Icon(Icons.edit_outlined, size: 16.r),
                    label: const Text('Edit'),
                  ),
              ],
            ),
            SizedBox(height: 8.h),
            Padding(
              padding: EdgeInsets.only(right: 6.w),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (rows != null && shown.isEmpty && child == null) _Empty('Nothing recorded'),
                  for (final r in shown)
                    Padding(
                      padding: EdgeInsets.symmetric(vertical: 5.h),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(width: 120.w, child: Text(r.$1, style: T.small)),
                          Expanded(child: Text(r.$2, style: T.bodyStrong.copyWith(fontSize: 13.5.sp))),
                        ],
                      ),
                    ),
                  ?child,
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Text extends StatelessWidget {
  const _Text(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(text, style: T.body.copyWith(color: C.ink));
}

class _Empty extends StatelessWidget {
  const _Empty(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(padding: EdgeInsets.symmetric(vertical: 4.h), child: Text(text, style: T.small));
}

class _Note extends StatelessWidget {
  const _Note(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(12.r),
    decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg)),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16.r, color: C.slate),
        SizedBox(width: 8.w),
        Expanded(child: Text(text, style: T.small.copyWith(fontSize: 12.sp))),
      ],
    ),
  );
}

/// A contact with call / email shortcuts.
class _ContactCard extends StatelessWidget {
  const _ContactCard({required this.kind, required this.c, required this.primary, required this.secondary});
  final String kind;
  final StudentContact c;
  final bool primary, secondary;
  @override
  Widget build(BuildContext context) {
    final who = kind == 'emergency' ? 'Emergency' : (c.relationship.isNotEmpty && kind == 'guardian' ? c.relationship : contactLabels[kind] ?? kind);
    final digits = c.phone.replaceAll(RegExp(r'[^0-9+]'), '');
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 5.h),
      child: Row(
        children: [
          Avatar(kind == 'emergency' ? '!' : (c.name.isEmpty ? who : c.name), size: 40, tone: kind == 'emergency' ? Tone.danger : Tone.brand),
          SizedBox(width: 10.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(child: Text(c.name.isEmpty ? who : c.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    if (primary) ...[SizedBox(width: 6.w), const Pill('Primary', tone: Tone.success)],
                    if (secondary) ...[SizedBox(width: 6.w), const Pill('Second', tone: Tone.neutral)],
                  ],
                ),
                Text(
                  [if (kind != 'emergency') who, if (c.phone.isNotEmpty) c.phone, if (c.occupation.isNotEmpty) c.occupation].join(' • '),
                  style: T.small.copyWith(fontSize: 12.sp),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (c.email.isNotEmpty) Text(c.email, style: T.small.copyWith(fontSize: 12.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          if (c.email.isNotEmpty)
            IconButton(
              tooltip: 'Email ${c.name}',
              onPressed: () => launchUrl(Uri(scheme: 'mailto', path: c.email)),
              icon: Icon(Icons.mail_outline_rounded, size: 20.r, color: C.primary),
            ),
          if (digits.isNotEmpty)
            IconButton(
              tooltip: 'Call ${c.name}',
              onPressed: () => launchUrl(Uri(scheme: 'tel', path: digits)),
              icon: Icon(Icons.call_outlined, size: 20.r, color: C.primary),
            ),
        ],
      ),
    );
  }
}

/// Shared shell of the edit sheets: the fields, the server's error, and Save (closes once the save landed).
class _FormShell extends StatelessWidget {
  const _FormShell({required this.children, required this.onSave});
  final List<Widget> children;
  final VoidCallback onSave;
  @override
  Widget build(BuildContext context) => BlocConsumer<StudentProfileBloc, StudentProfileState>(
    listenWhen: (a, b) => b.savedSeq > a.savedSeq,
    listener: (ctx, _) {
      Navigator.pop(ctx);
      AppDialogs.showSnackBar(ctx, message: 'Saved');
    },
    builder: (ctx, s) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ...children,
        if (s.saveError != null)
          Padding(
            padding: EdgeInsets.only(top: 8.h),
            child: Text(s.saveError!, style: T.small.copyWith(color: C.danger)),
          ),
        SizedBox(height: 14.h),
        AppButton(s.saving ? 'Saving…' : 'Save changes', key: const ValueKey('details-save'), icon: Icons.check_rounded, busy: s.saving, onPressed: s.saving ? null : onSave),
      ],
    ),
  );
}

Widget _field(String label, TextEditingController c, {TextInputType? keyboard, int maxLines = 1, String? hint, Key? key}) => Padding(
  padding: EdgeInsets.only(bottom: 10.h),
  child: TextField(
    key: key,
    controller: c,
    keyboardType: keyboard,
    maxLines: maxLines,
    minLines: 1,
    decoration: InputDecoration(labelText: label, hintText: hint, isDense: true),
  ),
);

class _ContactsForm extends StatefulWidget {
  const _ContactsForm({required this.d, required this.bloc});
  final StudentDetails d;
  final StudentProfileBloc bloc;
  @override
  State<_ContactsForm> createState() => _ContactsFormState();
}

class _ContactsFormState extends State<_ContactsForm> {
  late String _kind = widget.d.primary;
  late String _primary = widget.d.primary, _secondary = widget.d.secondary;
  late final _ctl = {
    for (final k in contactKinds)
      k: {
        for (final f in ['name', 'phone', 'email', 'occupation', 'relationship'])
          f: TextEditingController(text: widget.d.contact(k).toJson()[f] as String),
      },
  };
  late final _emergency = TextEditingController(text: widget.d.emergencyPhone);

  @override
  void dispose() {
    for (final m in _ctl.values) {
      for (final c in m.values) {
        c.dispose();
      }
    }
    _emergency.dispose();
    super.dispose();
  }

  void _save() {
    final contacts = {
      for (final k in contactKinds)
        k: widget.d.contact(k).copyWith(
          name: _ctl[k]!['name']!.text.trim(),
          phone: _ctl[k]!['phone']!.text.trim(),
          email: _ctl[k]!['email']!.text.trim(),
          occupation: _ctl[k]!['occupation']!.text.trim(),
          relationship: _ctl[k]!['relationship']!.text.trim(),
        ),
    };
    widget.bloc.add(StudentDetailsSaved(StudentDetailsPatch(
      contacts: {for (final e in contacts.entries) if (e.value != widget.d.contact(e.key)) e.key: e.value},
      primary: _primary,
      secondary: _secondary,
      emergencyPhone: _emergency.text.trim(),
    )));
  }

  @override
  Widget build(BuildContext context) {
    final c = _ctl[_kind]!;
    return _FormShell(
      onSave: _save,
      children: [
        AppSegmented(items: [for (final k in contactKinds) contactLabels[k]!], value: contactLabels[_kind]!, track: true, onChanged: (v) => setState(() => _kind = contactLabels.entries.firstWhere((e) => e.value == v).key)),
        SizedBox(height: 12.h),
        _field('Name', c['name']!, key: ValueKey('contact-$_kind-name')),
        _field('Mobile number', c['phone']!, keyboard: TextInputType.phone, key: ValueKey('contact-$_kind-phone')),
        _field('Email', c['email']!, keyboard: TextInputType.emailAddress),
        Row(
          children: [
            Expanded(child: _field('Occupation', c['occupation']!)),
            if (_kind == 'guardian') ...[SizedBox(width: 10.w), Expanded(child: _field('Relationship', c['relationship']!, hint: 'e.g. Uncle'))],
          ],
        ),
        Row(
          children: [
            Expanded(
              child: _Choice(
                label: 'Primary contact',
                value: _primary,
                items: contactKinds,
                onChanged: (v) => setState(() {
                  _primary = v;
                  if (_secondary == v) _secondary = '';
                }),
              ),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: _Choice(
                label: 'Second contact',
                value: _secondary,
                items: ['', ...contactKinds.where((k) => k != _primary)],
                onChanged: (v) => setState(() => _secondary = v),
              ),
            ),
          ],
        ),
        SizedBox(height: 10.h),
        _field('Emergency number', _emergency, keyboard: TextInputType.phone),
        Text('The primary contact is who the school calls and messages first; the parent app login is not changed.', style: T.small.copyWith(fontSize: 11.5.sp)),
      ],
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.label, required this.value, required this.items, required this.onChanged});
  final String label, value;
  final List<String> items;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => DropdownButtonFormField<String>(
    initialValue: items.contains(value) ? value : items.first,
    isExpanded: true,
    decoration: InputDecoration(labelText: label, isDense: true),
    items: [for (final k in items) DropdownMenuItem(value: k, child: Text(k.isEmpty ? 'None' : contactLabels[k] ?? k))],
    onChanged: (v) => onChanged(v ?? ''),
  );
}

class _AddressForm extends StatefulWidget {
  const _AddressForm({required this.d, required this.bloc});
  final StudentDetails d;
  final StudentProfileBloc bloc;
  @override
  State<_AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends State<_AddressForm> {
  late final r = widget.d.residence;
  late final _l1 = TextEditingController(text: r.line1), _l2 = TextEditingController(text: r.line2);
  late final _city = TextEditingController(text: r.city), _district = TextEditingController(text: r.district);
  late final _state = TextEditingController(text: r.state), _pin = TextEditingController(text: r.pin);

  @override
  void dispose() {
    for (final c in [_l1, _l2, _city, _district, _state, _pin]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _FormShell(
    onSave: () => widget.bloc.add(StudentDetailsSaved(StudentDetailsPatch(
      residence: StudentAddress(
        line1: _l1.text.trim(),
        line2: _l2.text.trim(),
        city: _city.text.trim(),
        district: _district.text.trim(),
        state: _state.text.trim(),
        pin: _pin.text.trim(),
        country: r.country.isEmpty ? 'IN' : r.country,
      ),
    ))),
    children: [
      _field('House / street', _l1, key: const ValueKey('address-line1')),
      _field('Area / landmark', _l2),
      Row(children: [Expanded(child: _field('City / town', _city)), SizedBox(width: 10.w), Expanded(child: _field('District', _district))]),
      Row(children: [Expanded(child: _field('State', _state)), SizedBox(width: 10.w), Expanded(child: _field('PIN code', _pin, keyboard: TextInputType.number))]),
    ],
  );
}

class _MedicalForm extends StatefulWidget {
  const _MedicalForm({required this.d, required this.bloc});
  final StudentDetails d;
  final StudentProfileBloc bloc;
  @override
  State<_MedicalForm> createState() => _MedicalFormState();
}

class _MedicalFormState extends State<_MedicalForm> {
  late String _blood = bloodGroups.contains(widget.d.bloodGroup) ? widget.d.bloodGroup : '';
  late final _conditions = TextEditingController(text: widget.d.conditions);
  late final _assistance = TextEditingController(text: widget.d.assistance);

  @override
  void dispose() {
    _conditions.dispose();
    _assistance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _FormShell(
    onSave: () => widget.bloc.add(StudentDetailsSaved(StudentDetailsPatch(
      bloodGroup: _blood,
      conditions: _conditions.text.trim(),
      assistance: _assistance.text.trim(),
    ))),
    children: [
      Text('Blood group', style: T.smallStrong),
      SizedBox(height: 6.h),
      Wrap(
        spacing: 6.w,
        runSpacing: 6.h,
        children: [
          for (final b in bloodGroups)
            ChoiceChip(
              label: Text(b.isEmpty ? 'Unknown' : b),
              selected: _blood == b,
              onSelected: (_) => setState(() => _blood = b),
            ),
        ],
      ),
      SizedBox(height: 12.h),
      _field('Medical conditions & allergies', _conditions, maxLines: 3, hint: 'e.g. Asthma — carries an inhaler', key: const ValueKey('medical-conditions')),
      _field('Support needs', _assistance, maxLines: 3, hint: 'e.g. Sits in the front row (hearing)'),
    ],
  );
}
