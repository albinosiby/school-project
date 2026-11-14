const { HttpsError } = require("firebase-functions/v2/https");
const options = require("./staffProfileOptions.json");

const clean = (value) => typeof value === "string" ? value.trim() : "";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const validEmail = (email) => email.length <= 254 && emailPattern.test(email);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9/-]{1,39}$/;
const validDocId = (value) => /^[A-Za-z0-9_-]{1,150}$/.test(value);
const validPhone = (phone) => /^\+?[\d -]+$/.test(phone) && /^\d{10,15}$/.test(phone.replace(/\D/g, ""));
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function readStaffProfile(input) {
  const errors = {};
  function text(source, key, max, required = false, path = key) {
    const value = clean(source?.[key]);
    if ((required && !value) || value.length > max) errors[path] = required && !value ? "Required." : `Use ${max} characters or fewer.`;
    return value;
  }

  function choice(source, key, choices, required = false, path = key) {
    const value = text(source, key, 120, required, path);
    if (value && !choices.includes(value)) errors[path] = "Choose a valid option.";
    return value;
  }

  function date(source, key, required = false, path = key) {
    const value = text(source, key, 10, required, path);
    if (value && !validDate(value)) errors[path] = "Enter a valid date.";
    return value;
  }

  function phone(source, key, required = false, path = key) {
    const value = text(source, key, 28, required, path);
    if (value && !validPhone(value)) errors[path] = "Enter a valid mobile number.";
    return value;
  }

  function number(source, key, max, { required = false, integer = false, path = key } = {}) {
    const value = text(source, key, 10, required, path);
    const parsed = Number(value);
    if (value && (!/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(parsed) || parsed > max || (integer && !Number.isInteger(parsed)))) {
      errors[path] = `Enter a valid number from 0 to ${max}.`;
    }
    return value;
  }

  function address(key) {
    const result = {};
    for (const [part, max] of Object.entries({ line1: 200, line2: 200, country: 2, state: 100, district: 100, city: 100, pin: 16 })) {
      result[part] = text(input?.[key], part, max, false, `${key}.${part}`);
    }
    if (result.country && !/^[A-Z]{2}$/.test(result.country)) errors[`${key}.country`] = "Choose a country.";
    if (result.country === "IN" && result.pin && !/^\d{6}$/.test(result.pin)) errors[`${key}.pin`] = "Enter a six-digit PIN code.";
    return result;
  }

  const category = choice(input, "category", ["Teaching", "Non-Teaching"], true);
  const teaching = category === "Teaching";
  const designation = text(input, "designation", 100, true);
  const birthDate = date(input, "birthDate", true);
  const joined = date(input, "joined", true);
  const empId = text(input, "empId", 40).toUpperCase();
  if (empId && !idPattern.test(empId)) errors.empId = "Use 2–40 letters, digits, hyphens or slashes.";
  if (birthDate && birthDate >= today()) errors.birthDate = "Enter a date of birth before today.";
  if (birthDate && joined && joined < birthDate) errors.joined = "Joining date must follow the date of birth.";

  const email = text(input, "contactEmail", 254).toLowerCase();
  if (email && !validEmail(email)) errors.contactEmail = "Enter a valid email address.";
  const nationality = text(input, "nationality", 2, true);
  if (nationality && !/^[A-Z]{2}$/.test(nationality)) errors.nationality = "Choose a nationality.";
  const employmentType = choice(input, "employmentType", options.employmentTypes, true);
  const contractStart = employmentType === "Contract" ? date(input, "contractStart", true) : "";
  const contractEnd = employmentType === "Contract" ? date(input, "contractEnd", true) : "";
  if (contractStart && contractEnd && contractEnd < contractStart) errors.contractEnd = "End date must be on or after the start date.";

  const emergency = input?.emergency;
  const emergencyContact = {
    name: text(emergency, "name", 120, true, "emergency.name"),
    relationship: text(emergency, "relationship", 80, true, "emergency.relationship"),
    mobile: phone(emergency, "mobile", true, "emergency.mobile"),
    alternate: phone(emergency, "alternate", false, "emergency.alternate"),
    address: text(emergency, "address", 350, false, "emergency.address"),
  };

  const qualifications = Array.isArray(input?.qualifications) ? input.qualifications : [];
  if (qualifications.length > 20) errors.qualifications = "Add up to 20 qualifications.";
  const qualificationRows = qualifications.slice(0, 20).map((row, i) => {
    const path = `qualifications.${i}`;
    const year = text(row, "year", 4, false, `${path}.year`);
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > Number(today().slice(0, 4)))) {
      errors[`${path}.year`] = "Enter a valid completion year.";
    }
    return {
      level: choice(row, "level", options.qualificationLevels, false, `${path}.level`),
      course: text(row, "course", 120, true, `${path}.course`),
      specialization: text(row, "specialization", 120, false, `${path}.specialization`),
      institution: text(row, "institution", 160, false, `${path}.institution`),
      year,
      grade: text(row, "grade", 60, false, `${path}.grade`),
    };
  });

  const firstName = text(input, "firstName", 60, true);
  const middleName = text(input, "middleName", 60);
  const lastName = text(input, "lastName", 60, true);
  const name = [firstName, middleName, lastName].filter(Boolean).join(" ");
  if (name.length > 120) errors.firstName = "Use 120 characters or fewer for the full name.";
  const primarySubject = teaching ? text(input, "primarySubject", 243, true) : "";
  const primarySubjectId = teaching ? text(input, "primarySubjectId", 1024) : "";
  const subjectIdentity = (name, id) => JSON.stringify(id ? ["id", id] : ["name", name]);
  const primaryIdentity = subjectIdentity(primarySubject, primarySubjectId);
  const subjectSelections = new Map();
  if (teaching && Array.isArray(input?.additionalSubjects)) {
    const ids = Array.isArray(input.additionalSubjectIds) ? input.additionalSubjectIds : [];
    input.additionalSubjects.forEach((value, index) => {
      const name = clean(value);
      const id = clean(ids[index]);
      if (!name && !id) return;
      if (!name || name.length > 243 || id.length > 1024) errors.additionalSubjects = "Choose valid subjects.";
      const identity = subjectIdentity(name, id);
      if (identity !== primaryIdentity) subjectSelections.set(identity, { name, id });
    });
  }
  if (subjectSelections.size > 40) errors.additionalSubjects = "Choose up to 40 additional subjects.";
  const additionalSubjects = [...subjectSelections.values()].map(({ name }) => name);
  const additionalSubjectIds = [...subjectSelections.values()].map(({ id }) => id);
  const tet = teaching ? choice(input, "tet", ["Yes", "No"]) : "";
  const currentAddress = address("currentAddress");
  const sameAddress = input?.sameAddress === true;
  const profile = {
    empId, firstName, middleName, lastName, birthDate, category, designation, joined, nationality,
    gender: choice(input, "gender", options.genders, true),
    bloodGroup: choice(input, "bloodGroup", options.bloodGroups),
    maritalStatus: choice(input, "maritalStatus", options.maritalStatuses),
    phone: phone(input, "phone", true),
    alternatePhone: phone(input, "alternatePhone"),
    contactEmail: email, sameAddress, currentAddress, permanentAddress: sameAddress ? currentAddress : address("permanentAddress"),
    department: text(input, "department", 100) || (teaching ? "Academics" : ""),
    employmentType, contractStart, contractEnd,
    employmentStatus: choice(input, "employmentStatus", options.employmentStatuses, true),
    probationMonths: number(input, "probationMonths", 120, { integer: true }),
    workShift: teaching ? "" : choice(input, "workShift", options.workShifts),
    emergency: emergencyContact, qualifications: qualificationRows,
    ...(teaching ? {
      departmentId: text(input, "departmentId", 150),
      teachingLevel: choice(input, "teachingLevel", options.teachingLevels),
      primarySubject, primarySubjectId, additionalSubjects, additionalSubjectIds,
      teachingExperience: number(input, "teachingExperience", 80, { required: true }),
      previousSchool: text(input, "previousSchool", 160), previousDesignation: text(input, "previousDesignation", 100),
      tet, tetCertificate: tet === "Yes" ? text(input, "tetCertificate", 100) : "",
      teachingQualification: choice(input, "teachingQualification", options.teachingQualifications),
      specialization: text(input, "specialization", 120),
    } : {
      workExperience: number(input, "workExperience", 80),
      previousOrganization: text(input, "previousOrganization", 160), skills: text(input, "skills", 350),
      professionalCertification: text(input, "professionalCertification", 160),
      licenseNumber: text(input, "licenseNumber", 100),
      ...(designation === "Driver" ? {
        licenseType: text(input, "licenseType", 100), licenseExpiry: date(input, "licenseExpiry"),
        vehicleCategory: text(input, "vehicleCategory", 100),
      } : {}),
    }),
  };

  if (Object.keys(errors).length) throw new HttpsError("invalid-argument", "Check the highlighted fields.", { fields: errors });
  return { profile, name };
}

module.exports = { readStaffProfile, clean, validDocId, validEmail };
