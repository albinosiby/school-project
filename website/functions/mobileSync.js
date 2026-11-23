const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { randomBytes, createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const domain = require('./mobileFeeDomain');
const regionalSettings = require('./mobileSettings');
const { ensureStaffSelf } = require('./staffSelf');
const validId = value => typeof value === 'string' && value.length <= 160 && /^[\w-]+$/.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const error = (code, message) => { throw new HttpsError(code, message); };

function mobileSync(db) {
  const school = sid => db.doc(`schools/${sid}`);
  async function actor(req) {
    if (!req.auth?.uid) error('unauthenticated', 'Sign in again.');
    const user = (await db.doc(`users/${req.auth.uid}`).get()).data();
    if (!user || !validId(user.schoolId) || !['parent', 'teacher', 'driver', 'attendant', 'staff', 'admin'].includes(user.role)) error('permission-denied', 'Your school login is unavailable.');
    const platform = await db.doc(`platform_schools/${user.schoolId}`).get();
    if (platform.get('status') === 'suspended' || user.disabled === true) error('permission-denied', 'Your school login is unavailable.');
    if (platform.get('rolloverJob')) error('failed-precondition', 'The school is updating the academic year. Please try again shortly.');
    if (user.role === 'parent' && user.parentCredentialVersion && !(req.auth.token?.firebase?.sign_in_provider === 'custom' && req.auth.token.parentCredentialVersion === user.parentCredentialVersion)) error('permission-denied', 'Sign in again.');
    return user;
  }
  async function ownStudent(req) {
    const user = await actor(req), id = req.data?.studentId;
    if (user.role !== 'parent' || !validId(id) || !(user.studentIds || []).includes(id)) error('permission-denied', 'This student is not linked to your login.');
    const snap = await school(user.schoolId).collection('students').doc(id).get();
    if (!snap.exists || snap.get('deleted') === true) error('not-found', 'The student record is unavailable.');
    return { user, student: { ...snap.data(), id } };
  }
  async function settings(sid, transaction) {
    const read = target => transaction ? transaction.get(target) : target.get();
    const s = school(sid), [config, terms, master] = await Promise.all([read(s.collection('set_config')), read(s.collection('set_terms')), read(s.collection('school').doc('school'))]);
    const cfg = Object.fromEntries(config.docs.filter(d => !d.get('deleted')).map(d => [d.id, d.data()]));
    const bell = cfg.bell;
    const rows = bell?.start && bell?.periodCount ? domain.buildSchedule(domain.initialBell({ ...bell, periods: bell.periodCount, len: bell.periodLength })).rows : [];
    const ranges = terms.docs.filter(d => !d.get('deleted')).map(d => ({ id: d.id, name: d.get('name') || d.id, start: d.get('start') || '', end: d.get('end') || '' }));
    const min = cfg.attendance_policy?.minimumPercent;
    const workingDays = regionalSettings.workingDays(cfg.regional?.workingWeek);
    const zone = String(cfg.regional?.timezone || 'Asia/Kolkata');
    const offset = regionalSettings.utcOffsetMinutes(zone);
    return { academicYear: master.get('academicYear') || cfg.meta?.academicYear || '',
      minimumAttendance: typeof min === 'number' && min >= 0 && min <= 100 ? min : 75,
      academicRange: domain.attendanceAcademicRange(ranges) || null, terms: ranges, workingDays,
      timezone: zone, utcOffsetMinutes: offset, schedule: rows.map(row => ({ label: row.label, start: row.from, end: row.to, isBreak: row.break === true, isGap: row.gap === true })) };
  }
  async function publish(sid, feeRevision) {
    return db.runTransaction(async tx => {
      const data = await settings(sid, tx), ref = school(sid).collection('school').doc('mobile');
      const previous = (await tx.get(ref)).data() || {};
      const revision = [feeRevision, previous.feeRevision].filter(Boolean).sort().at(-1);
      if (revision) data.feeRevision = revision;
      if (!isDeepStrictEqual(previous, data)) tx.set(ref, data);
      return data;
    });
  }
  async function studentAttendance(sid, studentId, policy, onlyMissing = false) {
    const s = school(sid), ref = s.collection('students').doc(studentId);
    await db.runTransaction(async tx => {
      const [student, details, published] = await Promise.all([tx.get(ref), tx.get(s.collection('adm_student_details').doc(studentId)), tx.get(s.collection('school').doc('mobile'))]);
      if (!student.exists || student.get('deleted')) return;
      const current = published.exists ? published.data() : policy;
      const admissionDate = details.get('admissionDate') || student.get('admissionDate') || '';
      const key = JSON.stringify([current.academicYear, current.academicRange, admissionDate]);
      if (onlyMissing && student.get('academicAttendance.key') === key) return;
      const months = await tx.get(s.collection('par_attendance').where('studentId', '==', studentId));
      const result = domain.recordedAttendance(months.docs.map(d => ({ ...d.data(), id: d.id })),
        [{ id: studentId, admissionDate }], current.academicRange || undefined).get(studentId);
      const academicAttendance = { key, admissionDate, academicYear: current.academicYear, start: current.academicRange?.start || '', end: current.academicRange?.end || '',
        percentage: result?.pct || 0, attended: result?.attended || 0, recordedDays: result?.days || 0 };
      if (!isDeepStrictEqual(student.get('academicAttendance'), academicAttendance)) tx.update(ref, { academicAttendance });
    });
  }
  async function bootstrapTeacherAttendance(user, policy) {
    const s = school(user.schoolId);
    const [assignments, periods, classes] = await Promise.all([
      s.collection('assignments').where('teacherId', '==', user.staffId).get(),
      s.collection('ops_periods').where('teacherId', '==', user.staffId).get(),
      s.collection('classes').where('classTeacherId', '==', user.staffId).get(),
    ]);
    const ids = [...new Set([...assignments.docs, ...periods.docs].map(d => d.get('classId')).concat(classes.docs.map(d => d.id)).filter(Boolean))];
    for (let offset = 0; offset < ids.length; offset += 30) {
      const students = await s.collection('students').where('classId', 'in', ids.slice(offset, offset + 30)).get();
      // Bound fan-out to a class at a time instead of opening thousands of parallel reads.
      for (let i = 0; i < students.docs.length; i += 10) await Promise.all(students.docs.slice(i, i + 10).map(d => studentAttendance(user.schoolId, d.id, policy, true)));
    }
  }
  async function records(user, student) {
    const s = school(user.schoolId), grn = String(student.grn || '');
    const [byId, byGrn, grnOwners, structures, concessions, terms, admissions, transport, config, master] = await Promise.all([
      s.collection('fee_invoices').where('studentId', '==', student.id).get(),
      grn ? s.collection('fee_invoices').where('grn', '==', grn).get() : null,
      grn ? s.collection('students').where('grn', '==', grn).get() : null,
      s.collection('fee_structure').where('grade', '==', student.grade).get(),
      grn ? s.collection('fee_concessions').where('grn', '==', grn).get() : null,
      s.collection('set_terms').get(), s.collection('adm_student_details').doc(student.id).get(),
      s.collection('student_transport_fees').doc(student.id).get(), s.collection('set_config').doc('fee_policy').get(), s.collection('school').doc('school').get(),
    ]);
    const rows = snap => snap ? snap.docs.filter(d => !d.get('deleted')).map(d => ({ ...d.data(), id: d.id })) : [];
    const invoices = [...new Map([...rows(byId), ...rows(byGrn)].map(r => [r.id, r])).values()];
    const owned = domain.studentFeeRecords(student, rows(grnOwners), invoices, [], rows(concessions));
    const academicYear = master.get('academicYear') || '';
    const plan = domain.studentFeePlan(student, rows(structures), academicYear);
    const annual = domain.annualStudentFees({ academicYear, items: plan.items, termsPerYear: plan.termsPerYear,
      terms: rows(terms), admissionDate: admissions.get('admissionDate') || student.admissionDate,
      invoices: owned.invoices, concessions: owned.concessions, busId: student.busId,
      transportAmount: domain.studentTransportFee({ ...student, transportFee: transport.data() }), transportFrequency: config.get('transportFrequency') });
    return { academicYear, ...annual, invoices: owned.invoices };
  }
  const getMobileSchoolContext = onCall({ timeoutSeconds: 120 }, async req => {
    const user = await actor(req), policy = await publish(user.schoolId);
    if (req.data?.refreshAttendance === true && user.role === 'teacher' && validId(user.staffId)) await bootstrapTeacherAttendance(user, policy);
    if (req.data?.refreshAttendance === true && ['teacher', 'staff', 'driver', 'attendant'].includes(user.role) && validId(user.staffId)) {
      // the staff member's own HR card (staff_self) is built here when it is missing or from an older shape
      await ensureStaffSelf(user.schoolId, user.staffId).catch(e => console.warn('staff_self could not be built', user.schoolId, user.staffId, String(e)));
    }
    if (req.data?.refreshAttendance === true && user.role === 'parent') await Promise.all((user.studentIds || []).filter(validId).slice(0, 30).map(id => studentAttendance(user.schoolId, id, policy, true)));
    return policy;
  });
  const getMobileStudentFees = onCall(async req => {
    const { user, student } = await ownStudent(req), annual = await records(user, student);
    return { academicYear: annual.academicYear, complete: annual.complete, issues: annual.issues, gross: annual.gross,
      concessions: annual.concessionsTotal, net: annual.net, paid: annual.paid, payable: annual.payable,
      charges: annual.charges.map(c => ({ name: c.name, amount: c.unitAmount, frequency: c.frequency, quantity: c.quantity, mandatory: c.mandatory })),
      invoiceIds: annual.invoices.map(i => i.id), approvedConcessions: annual.concessions.map(c => ({ type: c.type, amount: c.amount })) };
  });
  const getMobileStaffCertificates = onCall(async req => {
    const user = await actor(req);
    if (!['teacher', 'staff', 'driver', 'attendant'].includes(user.role) || !validId(user.staffId)) error('permission-denied', 'Your staff profile is not linked to this login.');
    const member = await school(user.schoolId).collection('staff').doc(user.staffId).get();
    if (!member.exists || member.get('deleted') || member.get('authUid') && member.get('authUid') !== req.auth.uid) error('permission-denied', 'Your staff profile is unavailable.');
    const rows = await school(user.schoolId).collection('certificates').where('staffId', '==', user.staffId).limit(250).get();
    return { schoolId: user.schoolId, certificates: rows.docs.filter(d => d.get('recipientKind') === 'staff' && !d.get('deleted')).map(d => ({
      id: d.id, type: d.get('type') || '', refNo: d.get('refNo') || '', status: d.get('status') || '',
      issuedOn: d.get('issuedOn') || '', validTill: d.get('validTill') || '',
    })).sort((a,b) => b.issuedOn.localeCompare(a.issuedOn)) };
  });
  const getMobileStudentTimetable = onCall(async req => {
    const { user, student } = await ownStudent(req), from = req.data?.weekStart;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !Number.isFinite(Date.parse(from)) || new Date(from).toISOString().slice(0,10) !== from) error('invalid-argument', 'Choose a valid week.');
    const end = new Date(Date.parse(from) + 6 * 86400000).toISOString().slice(0,10);
    if (!validId(student.classId)) return { substitutions: [] };
    const s = school(user.schoolId);
    const snap = await s.collection('ops_substitutions').where('classId', '==', student.classId).where('date', '>=', from).where('date', '<=', end).get();
    const rows = snap.docs.filter(d => !d.get('deleted') && !['Declined', 'Cancelled'].includes(d.get('status')) && d.get('substituteTeacherId'));
    const ids = [...new Set(rows.map(d => d.get('substituteTeacherId')).filter(validId))];
    const staff = ids.length ? await db.getAll(...ids.map(id => s.collection('staff').doc(id))) : [];
    const names = new Map(staff.map(d => [d.id, d.get('name') || 'Substitute teacher']));
    return { substitutions: rows.map(d => ({ date: d.get('date'), period: d.get('period'), subject: d.get('subject') || '',
      teacher: names.get(d.get('substituteTeacherId')) || 'Substitute teacher', room: d.get('room') || '', updatedAt: String(d.get('updatedAt') || '') }))
      .sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)) };
  });
  const downloadMobileFeeDocument = onCall(async req => {
    const { user, student } = await ownStudent(req), kind = req.data?.kind, id = req.data?.documentId;
    if (!['invoice', 'receipt'].includes(kind) || !validId(id)) error('invalid-argument', 'Choose an invoice or receipt.');
    const annual = await records(user, student);
    const payment = kind === 'receipt' ? await school(user.schoolId).collection('fee_payments').doc(id).get() : null;
    const invoiceId = payment ? payment.get('invoiceId') : id;
    if (!annual.invoices.some(i => i.id === invoiceId) || payment?.get('deleted') === true) error('permission-denied', 'This document is not linked to your student.');
    const token = randomBytes(32).toString('base64url'), expiresAt = Date.now() + 5 * 60 * 1000;
    await db.collection('mobile_document_tokens').doc(hash(token)).set({ uid: req.auth.uid, studentId: student.id, kind, documentId: id, expiresAt,
      schoolId: user.schoolId, parentCredentialVersion: user.parentCredentialVersion || '', deleteAt: new Date(expiresAt) });
    const project = process.env.GCLOUD_PROJECT;
    const base = process.env.FUNCTIONS_EMULATOR === 'true' ? `http://localhost:5001/${project}/asia-south1` : `https://asia-south1-${project}.cloudfunctions.net`;
    return { url: `${base}/mobileFeeFile?token=${token}` };
  });
  const mobileFeeFile = onRequest({ cors: false, timeoutSeconds: 30 }, async (req, res) => {
    res.set('Cache-Control', 'private, no-store'); res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'no-referrer');
    if (req.method !== 'GET' || !/^[\w-]{43}$/.test(req.query.token || '')) return res.status(404).end();
    try {
      const grant = await db.collection('mobile_document_tokens').doc(hash(req.query.token)).get();
      if (!grant.exists || grant.get('expiresAt') < Date.now()) return res.status(410).send('This link has expired. Open the document again in the app.');
      const user = (await db.doc(`users/${grant.get('uid')}`).get()).data();
      const platform = await db.doc(`platform_schools/${grant.get('schoolId')}`).get();
      if (!user || user.role !== 'parent' || user.disabled || user.schoolId !== grant.get('schoolId') || !(user.studentIds || []).includes(grant.get('studentId')) || (user.parentCredentialVersion || '') !== grant.get('parentCredentialVersion') || platform.get('status') === 'suspended') return res.status(404).end();
      const s = school(user.schoolId), student = await s.collection('students').doc(grant.get('studentId')).get();
      if (!student.exists || student.get('deleted')) return res.status(404).end();
      const annual = await records(user, { ...student.data(), id: student.id });
      const receipt = grant.get('kind') === 'receipt' ? await s.collection('fee_payments').doc(grant.get('documentId')).get() : null;
      const invoice = annual.invoices.find(i => i.id === (receipt ? receipt.get('invoiceId') : grant.get('documentId')));
      if (!invoice || receipt?.get('deleted')) return res.status(404).end();
      const master = await s.collection('school').doc('school').get();
      let logo;
      const logoPath = master.get('logoPath');
      if (typeof logoPath === 'string' && logoPath.startsWith(`schools/${user.schoolId}/branding/`)) {
        const file = require('firebase-admin/storage').getStorage().bucket().file(logoPath);
        try { const [meta] = await file.getMetadata(); if (Number(meta.size) <= 2 * 1024 * 1024 && ['image/png', 'image/jpeg'].includes(meta.contentType)) [logo] = await file.download(); } catch { /* A removed logo must not prevent an authorised invoice download. */ }
      }
      const pdf = await require('./mobileFeePdf').renderFeeDocument({ school: master.data() || {}, student: student.data(), invoice, receipt: receipt?.data(), logo });
      res.set('Content-Type', 'application/pdf'); res.set('Content-Disposition', `inline; filename="${receipt ? 'receipt' : 'invoice'}-${String(receipt?.get('receiptNo') || invoice.no || invoice.id).replace(/[^\w-]/g, '-')}.pdf"`);
      res.send(pdf);
    } catch { res.status(404).send('Document unavailable. Open it again in the app.'); }
  });
  return { getMobileSchoolContext, getMobileStudentFees, getMobileStaffCertificates, getMobileStudentTimetable, downloadMobileFeeDocument, mobileFeeFile,
    onMobileSettingsChanged: onDocumentWritten({ document: 'schools/{sid}/set_config/{id}', retry: true }, e => ['bell', 'regional', 'meta', 'attendance_policy', 'fee_policy'].includes(e.params.id) ? publish(e.params.sid, e.params.id === 'fee_policy' ? e.time : undefined) : undefined),
    onMobileTermsChanged: onDocumentWritten({ document: 'schools/{sid}/set_terms/{id}', retry: true }, e => publish(e.params.sid)),
    onMobileSchoolChanged: onDocumentWritten({ document: 'schools/{sid}/school/{id}', retry: true }, e => e.params.id === 'school' ? publish(e.params.sid) : undefined),
    onMobileFeePlanChanged: onDocumentWritten({ document: 'schools/{sid}/fee_structure/{id}', retry: true }, e => publish(e.params.sid, e.time)),
    onMobileAttendanceChanged: onDocumentWritten({ document: 'schools/{sid}/par_attendance/{id}', retry: true }, async e => {
      const id = e.data?.after?.get('studentId') || e.data?.before?.get('studentId');
      if (validId(id)) await studentAttendance(e.params.sid, id, await settings(e.params.sid));
    }),
    onMobileAdmissionChanged: onDocumentWritten({ document: 'schools/{sid}/adm_student_details/{id}', retry: true }, async e => {
      if (e.data?.before?.get('admissionDate') !== e.data?.after?.get('admissionDate')) await studentAttendance(e.params.sid, e.params.id, await settings(e.params.sid));
    }),
    onMobileSubstitutionChanged: onDocumentWritten({ document: 'schools/{sid}/ops_substitutions/{id}', retry: true }, async e => {
      const ids = [...new Set([e.data?.before?.get('classId'), e.data?.after?.get('classId')].filter(Boolean))];
      for (const id of ids) {
        const students = await school(e.params.sid).collection('students').where('classId', '==', id).get();
        await Promise.all(students.docs.map(d => d.ref.update({ timetableUpdatedAt: e.time })));
      }
    }),
    onMobileTransportFeeChanged: onDocumentWritten({ document: 'schools/{sid}/student_transport_fees/{id}', retry: true }, async e => {
      const ref = school(e.params.sid).collection('students').doc(e.params.id);
      if ((await ref.get()).exists) await ref.update({ feesUpdatedAt: e.time });
    }),
    onMobileConcessionChanged: onDocumentWritten({ document: 'schools/{sid}/fee_concessions/{id}', retry: true }, async e => {
      const grns = [...new Set([e.data?.before?.get('grn'), e.data?.after?.get('grn')].filter(Boolean))];
      for (const grn of grns) {
        const students = await school(e.params.sid).collection('students').where('grn', '==', grn).get();
        await Promise.all(students.docs.map(d => d.ref.update({ feesUpdatedAt: e.time })));
      }
    }),
  };
}
module.exports = { mobileSync };
