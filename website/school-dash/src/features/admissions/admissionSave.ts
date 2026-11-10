import { runTransaction } from "firebase/firestore";
import { createStamp, schoolDoc, stamp } from "@/features/fees/logic";
import { admissionChecklist } from "./admissionDocuments";
import { todayIso } from "@/features/ops/shared";
import { defaultNumbering, formatAdmissionNumber, validAdmissionNumber, validNumberTemplate, type AdmissionNumbering } from "./numbering";
import { nextStudentId, studentClassId, type StudentDoc } from "@/features/people/studentLogic";
import { classStream, isSeniorGrade, streamIdOf } from "@/lib/academicStreams";
import { db } from "@/lib/firebase";
import { computeSeatRows, docsComplete, type ClassRef, type StudentRow } from "./logic";
import { studentGrade, type Application, type Enquiry, type Offer, type Seat } from "./types";

export async function saveAdmission(values: StudentDoc, data: {
  students: StudentRow[];
  classes: ClassRef[];
  applications: Application[];
  offers: Offer[];
  seats: Seat[];
  application?: Application;
  enquiry?: Enquiry;
  offer?: Offer;
  recordAdmission: boolean;
  requestId?: string;
}) {
  const { students, classes, applications, offers, seats, application, enquiry, offer, recordAdmission, requestId } = data;
  const id = nextStudentId(students.map((row) => row.id));
  const studentRef = schoolDoc("students", id);
  const classRef = values.classId ? schoolDoc("classes", values.classId) : null;
  const enquiryId = enquiry?.id || application?.enquiryId;
  const enquiryRef = enquiryId ? schoolDoc("adm_enquiries", enquiryId) : null;
  const numberingRef = recordAdmission ? schoolDoc("adm_config", "numbering") : null;
  const requestRef = requestId ? schoolDoc("adm_requests", requestId) : null;
  const appRef = application ? schoolDoc("adm_applications", application.id) : null;
  const offerRef = offer ? schoolDoc("adm_offers", offer.id) : null;
  const cohort = values.streamId ? `${values.grade}-${values.streamId}` : values.grade;
  const seat = seats.find((row) => {
    const stream = streamIdOf(row.streamId || row.grade.split("-").slice(1).join("-"));
    return (stream ? `${studentGrade(row.grade)}-${stream}` : row.grade) === cohort;
  });
  const seatRef = seat ? schoolDoc("adm_seats", seat.id) : null;
  const configuredClass = classes.find((row) => row.id === values.classId);

  return runTransaction(db, async (tx) => {
    const [student, section, app, savedOffer, savedSeat, savedEnquiry, numbering, request] = await Promise.all([
      tx.get(studentRef), classRef && tx.get(classRef), appRef && tx.get(appRef),
      offerRef && tx.get(offerRef), seatRef && tx.get(seatRef),
      enquiryRef && tx.get(enquiryRef), numberingRef && tx.get(numberingRef), requestRef && tx.get(requestRef),
    ]);
    const savedApp = app?.exists() ? app.data() as Application : undefined;
    const priorStudentId = (request?.get("studentId") as string | undefined) || (savedEnquiry?.get("studentId") as string | undefined) || savedApp?.studentId || (savedOffer?.get("status") === "enrolled" ? savedOffer.get("studentId") as string : "");
    if (priorStudentId) return priorStudentId;

    if (enquiry && (!savedEnquiry?.exists() || savedEnquiry.get("stage") === "lost")) {
      throw new Error("Reopen this enquiry before making an admission.");
    }
    const legacyAppRef = enquiry && savedEnquiry?.get("applicationId")
      ? schoolDoc("adm_applications", savedEnquiry.get("applicationId") as string) : null;
    if (legacyAppRef) {
      const legacyApp = await tx.get(legacyAppRef);
      const linkedStudent = legacyApp.get("studentId") as string | undefined;
      if (linkedStudent) return linkedStudent;
      if (legacyApp.get("offerId")) throw new Error("This enquiry already has an offer. Complete admission through that offer.");
    }

    if (application) {
      if (!savedApp || savedApp.grade !== application.grade || studentGrade(savedApp.grade) !== values.grade ||
          streamIdOf(savedApp.grade.split("-").slice(1).join("-")) !== (values.streamId ?? "")) {
        throw new Error("The application grade or course changed. Reopen the application.");
      }
      if (offer) {
        if (savedApp.status !== "offered" || (savedApp.offerId && savedApp.offerId !== offer.id) ||
            savedOffer?.get("status") !== "accepted" || savedOffer.get("applicationId") !== application.id ||
            savedOffer.get("grade") !== savedApp.grade) {
          throw new Error("The offer must be accepted before enrolment.");
        }
      } else if (savedApp.status !== "approved" || !docsComplete(savedApp) || savedApp.offerId) {
        throw new Error("Approve the application before enrolling the student.");
      }
    }

    // All student creation paths use the next roster ID. A concurrent add must
    // refresh its roster before it can reuse its seat, GRN and roll calculations.
    if (student.exists()) throw new Error("Another student was just added. Check the details and try again.");
    if (Boolean(section?.exists()) !== !!configuredClass ||
        (section?.exists() && (section.get("grade") !== values.grade || section.get("section") !== values.section ||
          classStream(section.data()) !== (values.streamId ?? "") || section.get("capacity") !== configuredClass?.capacity))) {
      throw new Error("The selected section changed. Check the section and try again.");
    }
    if (classRef && isSeniorGrade(values.grade) && !section?.exists()) throw new Error("Choose a configured section for this course.");

    if (values.status === "Active") {
      const sectionCapacity = configuredClass?.capacity;
      if (typeof sectionCapacity === "number" && students.filter((row) =>
        !row.deleted && (!row.status || row.status === "Active") && studentClassId(row) === values.classId,
      ).length >= sectionCapacity) {
        throw new Error("This section has no available seats.");
      }
      if (seat) {
        if (!savedSeat?.exists() || savedSeat.get("capacity") !== seat.capacity ||
            (savedSeat.get("reservationRevision") ?? 0) !== (seat.reservationRevision ?? 0) ||
            (seat.latestReservationId && !offers.some((row) => row.id === seat.latestReservationId))) {
          throw new Error("Seat availability changed. Check the section and try again.");
        }
        // An accepted offer already holds one seat for this application.
        const [availability] = computeSeatRows([seat], applications, offers.filter((row) => row.id !== offer?.id), students);
        if (availability && availability.free <= 0) throw new Error("All seats for this grade and course are occupied or reserved.");
      }
    }

    const { admissionDetails, requestedAdmissionNumber, ...studentFields } = values;
    const admissionDate = admissionDetails?.admissionDate || todayIso();
    let admissionNumber = "";
    if (numberingRef) {
      const config = { ...defaultNumbering, ...numbering?.data() } as AdmissionNumbering;
      let sequence = Math.max(config.start, config.next ?? config.start);
      if (config.mode === "automatic" && !validNumberTemplate(config.template)) {
        throw new Error("Check the admission number template in Settings.");
      }
      let reserved;
      for (let attempt = 0; attempt < 30; attempt++) {
        admissionNumber = config.mode === "manual" ? requestedAdmissionNumber ?? ""
          : formatAdmissionNumber(config.template, admissionDate, sequence);
        if (!validAdmissionNumber(admissionNumber)) throw new Error("Enter a valid admission number.");
        const candidate = schoolDoc("adm_numbers", admissionNumber.toLowerCase());
        const claim = await tx.get(candidate);
        if (!claim.exists()) { reserved = candidate; break; }
        if (config.mode === "manual") throw new Error("This admission number is already in use.");
        sequence++;
      }
      if (!reserved) throw new Error("Update the starting number in Admission Settings and try again.");
      tx.set(reserved, { id: reserved.id, studentId: id, ...createStamp() });
      if (config.mode === "automatic") tx.set(numberingRef, { ...config, next: sequence + 1, ...stamp() });
    }
    if (classRef && !section?.exists() && recordAdmission) {
      tx.set(classRef, { id: classRef.id, grade: values.grade, section: values.section, classTeacherId: "", room: "", wing: "", ...createStamp() });
    }
    tx.set(studentRef, {
      ...studentFields, id, roll: 0, guardianUids: [], ...(recordAdmission ? { admissionDate, admissionNumber } : {}),
      ...(admissionDetails?.gender || savedApp?.gender ? { gender: admissionDetails?.gender || savedApp?.gender } : {}),
      ...(admissionDetails && studentFields.guardianEmail ? { guardianLoginName: studentFields.guardian } : {}),
      ...(admissionDetails?.academicYear ? { academicYear: admissionDetails.academicYear } : {}),
      ...(appRef || legacyAppRef ? { applicationId: (appRef || legacyAppRef)!.id } : {}),
      ...(offer ? { offerId: offer.id } : {}), ...createStamp(),
    });
    if (admissionDetails) {
      tx.set(schoolDoc("adm_student_details", id), { id, ...admissionDetails, ...createStamp() });
      tx.set(schoolDoc("adm_documents", id), { ...admissionChecklist(id, admissionDetails.admissionType === "Transfer"), ...createStamp() });
    }
    if (requestRef) tx.set(requestRef, { id: requestRef.id, studentId: id, ...createStamp() });
    if (legacyAppRef) tx.update(legacyAppRef, { status: "enrolled", studentId: id, ...stamp() });
    if (seatRef && seat && values.status === "Active") tx.update(seatRef, { reservationRevision: (seat.reservationRevision ?? 0) + 1 });
    if (appRef) tx.update(appRef, { status: "enrolled", studentId: id, ...stamp() });
    if (offerRef) tx.update(offerRef, { status: "enrolled", studentId: id, ...stamp() });
    if (enquiryRef && savedEnquiry?.exists()) tx.update(enquiryRef, { stage: "enrolled", studentId: id, ...stamp() });
    return id;
  });
}
