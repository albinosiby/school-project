import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../utils/mixins/validation_mixins.dart';
import '../bloc/registration_bloc.dart';
import '../models/auth_models.dart';
import '../repositories/auth_demo_data.dart';
import 'widgets/auth_page.dart';
import 'widgets/mobile_number_field.dart';
import 'widgets/school_contact.dart';

/// "14/08/2010" -> DateTime, or null.
DateTime? parseDmy(String? v) {
  final m = RegExp(
    r'^\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\s*$',
  ).firstMatch(v ?? '');
  if (m == null) return null;
  final d = int.parse(m[1]!), mo = int.parse(m[2]!), y = int.parse(m[3]!);
  final date = DateTime(y, mo, d);
  return (date.day == d && date.month == mo && date.year == y) ? date : null;
}

String formatDmy(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

/// Figma "Onboarding 1.1": New Parent Registration / Admission Verification.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  static const relations = ['Mother', 'Father', 'Guardian'];

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> with ValidationMixin {
  final _studentForm = GlobalKey<FormState>();
  final _guardianForm = GlobalKey<FormState>();
  final _admissionNo = TextEditingController();
  final _dob = TextEditingController();
  final _name = TextEditingController();
  final _mobile = TextEditingController();
  String _relation = '';
  bool _declared = false;
  bool _showGuardianErrors = false;

  @override
  void dispose() {
    _admissionNo.dispose();
    _dob.dispose();
    _name.dispose();
    _mobile.dispose();
    super.dispose();
  }

  String? _validateAdmissionNo(String? v) {
    if (v == null || v.trim().isEmpty)
      return 'Admission / scholar no. is required';
    return RegExp(r'^[A-Za-z]{2,4}[-/ ]\d{4}[-/ ]\d{3,5}$').hasMatch(v.trim())
        ? null
        : 'Use the format GIS-YYYY-####';
  }

  String? _validateDob(String? v) {
    if (v == null || v.trim().isEmpty) return 'Date of birth is required';
    final d = parseDmy(v);
    if (d == null) return 'Enter the date as DD/MM/YYYY';
    if (d.isAfter(DateTime.now()))
      return 'Date of birth cannot be in the future';
    return null;
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: parseDmy(_dob.text) ?? DateTime(now.year - 12),
      firstDate: DateTime(now.year - 25),
      lastDate: now,
      helpText: 'Student date of birth',
    );
    if (picked != null) setState(() => _dob.text = formatDmy(picked));
  }

  void _lookup() {
    if (!(_studentForm.currentState?.validate() ?? false)) return;
    context.read<RegistrationBloc>().add(
      StudentLookupRequested(_admissionNo.text, parseDmy(_dob.text)!),
    );
  }

  void _scanQr(List<StudentMatch> added) {
    final next = AuthDemoData.admissionRecords
        .where((r) => !added.any((s) => s.admissionNo == r.admissionNo))
        .firstOrNull;
    if (next == null) {
      AppDialogs.showSnackBar(
        context,
        message: 'All demo admission slips are already added',
      );
      return;
    }
    setState(() {
      _admissionNo.text = next.admissionNo;
      _dob.text = formatDmy(next.dob);
    });
    AppDialogs.showSnackBar(
      context,
      message: 'Admission slip scanned (demo): ${next.admissionNo}',
    );
  }

  void _submit() {
    setState(() => _showGuardianErrors = true);
    final ok = _guardianForm.currentState?.validate() ?? false;
    if (!ok || _relation.isEmpty || !_declared) return;
    context.read<RegistrationBloc>().add(
      RegistrationSubmitted(
        guardianName: _name.text,
        relation: _relation,
        phone: _mobile.text,
      ),
    );
  }

  @override
  Widget build(
    BuildContext context,
  ) => BlocConsumer<RegistrationBloc, RegistrationState>(
    listenWhen: (a, b) => b.students.length > a.students.length,
    listener: (context, s) {
      _admissionNo.clear();
      _dob.clear();
      AppDialogs.showSnackBar(
        context,
        message: '${s.students.last.name} verified and added',
      );
    },
    builder: (context, s) => s.result != null
        ? _Success(result: s.result!)
        : AuthPage(
            children: [
              AppFlowHeader(
                'New parent registration',
                fallbackRoute: RoutePaths.welcome,
              ),
              SizedBox(height: 12.h),
              const Align(
                alignment: Alignment.centerLeft,
                child: Pill(
                  'OFFICIAL GUARDIAN ENROLLMENT',
                  icon: Icons.shield_rounded,
                ),
              ),
              SizedBox(height: 12.h),
              Text('Admission Verification', style: T.title),
              SizedBox(height: 6.h),
              Text(
                "Enter your ward's admission details or slip credentials to seamlessly verify and link your guardian profile.",
                style: T.body.copyWith(fontSize: 13.sp),
              ),
              SizedBox(height: 16.h),
              _slipCard(s),
              for (final st in s.students) ...[
                SizedBox(height: 12.h),
                _MatchCard(student: st),
              ],
              SizedBox(height: 14.h),
              _guardianCard(s),
              SizedBox(height: 14.h),
              _declaration(),
              if (s.submit == SubmitStatus.failed && s.submitError != null)
                Padding(
                  padding: EdgeInsets.only(top: 10.h),
                  child: Text(
                    s.submitError!,
                    key: const Key('register-submit-error'),
                    style: T.small.copyWith(color: C.danger),
                  ),
                ),
              SizedBox(height: 14.h),
              AppButton(
                'Verify & Submit',
                key: const Key('register-submit'),
                icon: Icons.how_to_reg_rounded,
                busy: s.submit == SubmitStatus.submitting,
                onPressed: _submit,
              ),
              SizedBox(height: 6.h),
              Center(
                child: TextButton(
                  key: const Key('register-sign-in'),
                  onPressed: () => context.go(RoutePaths.login),
                  style: TextButton.styleFrom(minimumSize: Size(0, 44.h)),
                  child: Text.rich(
                    TextSpan(
                      text: 'Already registered? ',
                      style: T.small.copyWith(fontSize: 13.sp),
                      children: [
                        TextSpan(
                          text: 'Sign In',
                          style: T.bodyStrong.copyWith(
                            color: C.primary,
                            fontSize: 13.sp,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              HelpLink(
                prompt: 'Need help finding Admission No.?',
                link: 'Admissions Desk',
                onTap: () => callSchoolDesk(context, desk: 'Admissions Desk'),
              ),
            ],
          ),
  );

  Widget _slipCard(RegistrationState s) => AppCard(
    child: Form(
      key: _studentForm,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const IconTile(Icons.confirmation_number_outlined, size: 40),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Admission Slip Details', style: T.h3),
                    Text(
                      'Printed on your latest school term receipt',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: T.small.copyWith(fontSize: 11.sp),
                    ),
                  ],
                ),
              ),
              TextButton.icon(
                key: const Key('register-scan-qr'),
                onPressed: () => _scanQr(s.students),
                style: TextButton.styleFrom(
                  backgroundColor: C.primarySoft,
                  minimumSize: Size(0, 44.h),
                  padding: EdgeInsets.symmetric(horizontal: 10.w),
                ),
                icon: Icon(Icons.qr_code_scanner_rounded, size: 16.r),
                label: Text(
                  'Scan QR',
                  style: T.smallStrong.copyWith(color: C.primary),
                ),
              ),
            ],
          ),
          SizedBox(height: 16.h),
          AppTextField(
            key: const Key('register-admission-no'),
            label: 'Student Admission / Scholar No.  ·  Format: GIS-YYYY-####',
            hint: 'GIS-2021-0142',
            controller: _admissionNo,
            validator: _validateAdmissionNo,
          ),
          AppTextField(
            key: const Key('register-dob'),
            label: 'Student Date of Birth',
            hint: 'DD/MM/YYYY',
            controller: _dob,
            keyboard: TextInputType.datetime,
            validator: _validateDob,
            suffix: IconButton(
              tooltip: 'Pick date',
              onPressed: _pickDob,
              icon: Icon(Icons.calendar_today_outlined, size: 18.r),
            ),
          ),
          if (s.lookup == LookupStatus.failed && s.lookupError != null)
            Padding(
              padding: EdgeInsets.only(bottom: 10.h),
              child: Text(
                s.lookupError!,
                key: const Key('register-lookup-error'),
                style: T.small.copyWith(color: C.danger),
              ),
            ),
          AppButton(
            s.students.isEmpty ? 'Verify Student' : 'Add Student',
            key: const Key('register-lookup'),
            kind: BtnKind.outline,
            icon: s.students.isEmpty ? Icons.search_rounded : Icons.add_rounded,
            busy: s.lookup == LookupStatus.looking,
            onPressed: _lookup,
          ),
        ],
      ),
    ),
  );

  Widget _guardianCard(RegistrationState s) => AppCard(
    child: Form(
      key: _guardianForm,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const IconTile(Icons.family_restroom_rounded, size: 40),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Guardian Contact & KYC', style: T.h3),
                    Text(
                      'Authorized primary contact for official notices',
                      style: T.small.copyWith(fontSize: 11.sp),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 16.h),
          AppTextField(
            key: const Key('register-name'),
            label: 'Parent / Legal Guardian Full Name',
            hint: 'e.g. Mrs. Priya Sharma',
            controller: _name,
            validator: (v) => (v == null || v.trim().length < 3)
                ? 'Enter the full name'
                : null,
          ),
          Text(
            'Relationship to Student',
            style: T.smallStrong.copyWith(color: C.slate),
          ),
          SizedBox(height: 8.h),
          AppChoiceChips(
            items: RegisterScreen.relations,
            value: _relation,
            solid: true,
            onChanged: (v) => setState(() => _relation = v),
          ),
          if (_showGuardianErrors && _relation.isEmpty)
            Padding(
              padding: EdgeInsets.only(top: 6.h),
              child: Text(
                'Choose your relationship',
                style: T.small.copyWith(color: C.danger),
              ),
            ),
          SizedBox(height: 14.h),
          Text(
            'Primary Registered Mobile Number',
            style: T.smallStrong.copyWith(color: C.slate),
          ),
          SizedBox(height: 6.h),
          MobileNumberField(
            controller: _mobile,
            fieldKey: const Key('register-mobile'),
            helper:
                'A 6-digit verification code will be sent to confirm custody rights.',
          ),
        ],
      ),
    ),
  );

  Widget _declaration() => Container(
    padding: EdgeInsets.all(12.r),
    decoration: BoxDecoration(
      color: C.panel,
      borderRadius: BorderRadius.circular(R.md),
      border: Border.all(
        color: _showGuardianErrors && !_declared ? C.danger : C.panelBorder,
      ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          key: const Key('register-declare'),
          onTap: () => setState(() => _declared = !_declared),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Checkbox(
                value: _declared,
                onChanged: (v) => setState(() => _declared = v ?? false),
              ),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(top: 10.h),
                  child: Text(
                    'I declare under penalty of regulation that I am the parent or legally appointed guardian entitled to official school records.',
                    style: T.small.copyWith(color: C.ink),
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 6.h),
        Row(
          children: [
            Icon(Icons.lock_outline_rounded, size: 14.r, color: C.slate),
            SizedBox(width: 6.w),
            Expanded(
              child: Text(
                'Protected under Digital Personal Data Protection (DPDP Act 2023)',
                style: T.small.copyWith(fontSize: 11.sp),
              ),
            ),
          ],
        ),
        if (_showGuardianErrors && !_declared)
          Padding(
            padding: EdgeInsets.only(top: 6.h),
            child: Text(
              'Please accept the declaration',
              style: T.small.copyWith(color: C.danger),
            ),
          ),
      ],
    ),
  );
}

/// "VERIFIED STUDENT MATCH" card with a remove action.
class _MatchCard extends StatelessWidget {
  const _MatchCard({required this.student});
  final StudentMatch student;

  @override
  Widget build(BuildContext context) => AppCard(
    padding: EdgeInsets.fromLTRB(14.w, 12.h, 6.w, 12.h),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('VERIFIED STUDENT MATCH', style: T.capsMuted)),
            const Pill(
              'Record Verified',
              tone: Tone.success,
              icon: Icons.check_circle_rounded,
            ),
            IconButton(
              tooltip: 'Remove ${student.name}',
              onPressed: () => context.read<RegistrationBloc>().add(
                StudentRemoved(student.admissionNo),
              ),
              icon: Icon(Icons.close_rounded, size: 18.r, color: C.slate),
            ),
          ],
        ),
        Row(
          children: [
            Avatar(student.name, size: 52),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    student.name,
                    style: T.h2,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'Class ${student.className} • Roll #${student.rollNo}',
                    style: T.bodyStrong.copyWith(color: C.slate),
                  ),
                  Text(
                    '${student.school} • ${student.admissionNo}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.small.copyWith(color: C.muted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

/// Shown after the registration is created: it waits for the school office.
class _Success extends StatelessWidget {
  const _Success({required this.result});
  final PendingRegistration result;

  @override
  Widget build(BuildContext context) {
    final r = result.request;
    final phone = '+91 ${r.phone.substring(0, 5)} ${r.phone.substring(5)}';
    return AuthPage(
      children: [
        AppFlowHeader(
          'New parent registration',
          onBack: () => context.go(RoutePaths.welcome),
        ),
        SizedBox(height: 32.h),
        Center(
          child: Container(
            width: 72.r,
            height: 72.r,
            decoration: const BoxDecoration(
              color: C.successSoft,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.task_alt_rounded,
              size: 38.r,
              color: C.successDark,
            ),
          ),
        ),
        SizedBox(height: 16.h),
        Text(
          'Registration submitted',
          textAlign: TextAlign.center,
          style: T.title,
        ),
        SizedBox(height: 8.h),
        Text(
          'The school office will verify your custody details within 2 working days. '
          'We will send a confirmation code to $phone.',
          textAlign: TextAlign.center,
          style: T.body,
        ),
        SizedBox(height: 18.h),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: Text('Reference', style: T.small)),
                  Text(
                    result.reference,
                    key: const Key('register-reference'),
                    style: T.h3,
                  ),
                ],
              ),
              SizedBox(height: 8.h),
              Row(
                children: [
                  Expanded(child: Text('Status', style: T.small)),
                  const Pill(
                    'Pending verification',
                    tone: Tone.warning,
                    dot: true,
                  ),
                ],
              ),
              SizedBox(height: 8.h),
              Row(
                children: [
                  Expanded(child: Text('Guardian', style: T.small)),
                  Flexible(
                    child: Text(
                      '${r.guardianName} (${r.relation})',
                      overflow: TextOverflow.ellipsis,
                      style: T.bodyStrong,
                    ),
                  ),
                ],
              ),
              Divider(color: C.border, height: 24.h),
              for (final st in r.students)
                Padding(
                  padding: EdgeInsets.only(bottom: 6.h),
                  child: Row(
                    children: [
                      Avatar(st.name, size: 32),
                      SizedBox(width: 10.w),
                      Expanded(
                        child: Text(
                          '${st.name} • Class ${st.className}',
                          overflow: TextOverflow.ellipsis,
                          style: T.bodyStrong,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        SizedBox(height: 20.h),
        AppButton(
          'Go to Sign In',
          icon: Icons.login_rounded,
          onPressed: () => context.go(RoutePaths.login),
        ),
        SizedBox(height: 10.h),
        AppButton(
          'Back to Welcome',
          kind: BtnKind.outline,
          onPressed: () => context.go(RoutePaths.welcome),
        ),
      ],
    );
  }
}
