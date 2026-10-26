import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/mixins/validation_mixins.dart';
import '../../../school/bloc/school_bloc.dart';
import '../../../school/bloc/school_events.dart';
import '../../../school/models/school_models.dart';

/// "Edit account" sheet (Profile edit button, Settings account card). Saves through SchoolBloc (TeacherUpdated).
Future<void> showEditAccountSheet(BuildContext context) {
  final bloc = context.read<SchoolBloc>();
  final teacher = bloc.state.teacher;
  if (teacher == null) return Future.value();
  return showAppSheet<void>(
    context,
    title: 'Edit account',
    subtitle: 'Update your faculty profile details',
    builder: (ctx) => _EditAccountForm(
      teacher: teacher,
      onSave: (t) {
        bloc.add(TeacherUpdated(t));
        Navigator.pop(ctx);
        AppDialogs.showSnackBar(context, message: 'Account updated');
      },
    ),
  );
}

class _EditAccountForm extends StatefulWidget {
  const _EditAccountForm({required this.teacher, required this.onSave});
  final Teacher teacher;
  final ValueChanged<Teacher> onSave;
  @override
  State<_EditAccountForm> createState() => _EditAccountFormState();
}

class _EditAccountFormState extends State<_EditAccountForm> with ValidationMixin {
  final _key = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.teacher.name);
  late final _designation = TextEditingController(text: widget.teacher.designation);
  late final _email = TextEditingController(text: widget.teacher.email);
  late final _phone = TextEditingController(text: widget.teacher.phone);

  @override
  void dispose() {
    for (final c in [_name, _designation, _email, _phone]) {
      c.dispose();
    }
    super.dispose();
  }

  void _save() {
    if (!_key.currentState!.validate()) return;
    widget.onSave(Teacher.fromJson({
      ...widget.teacher.toJson(),
      'name': _name.text.trim(), 'designation': _designation.text.trim(), 'email': _email.text.trim(), 'phone': _phone.text.trim(),
    }));
  }

  @override
  Widget build(BuildContext context) => Form(
        key: _key,
        child: Column(children: [
          AppTextField(label: 'Full name', controller: _name, validator: (v) => (v == null || v.trim().length < 3) ? 'Enter your full name' : null),
          AppTextField(label: 'Designation', controller: _designation, validator: (v) => validateRequired(v, fieldName: 'Designation')),
          AppTextField(label: 'Email', controller: _email, keyboard: TextInputType.emailAddress, validator: (v) => validateEmail(v?.trim())),
          AppTextField(label: 'Phone', controller: _phone, keyboard: TextInputType.phone, validator: validatePhone),
          SizedBox(height: 4.h),
          AppButton('Save changes', onPressed: _save),
        ]),
      );
}
