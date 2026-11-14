// Pure result calculation shared by the dashboard and parent-result projections.
function rounded(value, rule) {
  const places = { whole: 0, "one-decimal": 1, "two-decimal": 2 }[rule];
  return places === undefined ? value : Number(value.toFixed(places));
}
function gradeFor(pct, scale) {
  if (scale === "Percentage only") return String(pct) + "%";
  if (scale === "GPA (4 point)")
    return pct >= 90 ? "4.0" : pct >= 80 ? "3.0" : pct >= 70 ? "2.0" : pct >= 60 ? "1.0" : "0.0";
  if (scale === "5-Point Letter Scale")
    return pct >= 80 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : pct >= 33 ? "D" : "E";
  return pct >= 91
    ? "A1"
    : pct >= 81
      ? "A2"
      : pct >= 71
        ? "B1"
        : pct >= 61
          ? "B2"
          : pct >= 51
            ? "C1"
            : pct >= 41
              ? "C2"
              : pct >= 33
                ? "D"
                : "E";
}
function markFingerprint(mark, paper) {
  return JSON.stringify([
    mark?.theory ?? null,
    mark?.internal ?? null,
    mark?.practical ?? null,
    mark?.gradeValue ?? "",
    mark?.status ?? "Present",
    mark?.medical ?? false,
    paper.setupVersion ?? 0,
  ]);
}
function assessMark(mark, paper) {
  const empty = { total: null, pct: null, grade: "--", passed: null };
  const verified =
    mark?.verified && (mark.verificationFingerprint ? mark.verificationFingerprint === markFingerprint(mark, paper) : !paper.setupVersion);
  const status = String(mark?.status ?? "").toLowerCase();
  if (status === "exempt") return { ...empty, state: "exempt", grade: "EX" };
  if (status.startsWith("medical") || mark?.medical === true) return { ...empty, state: "medical" };
  if (paper.assessmentMode === "grade" && (status === "absent" || status === "disqualified"))
    return { ...empty, state: "absent", grade: status === "absent" ? "AB" : "DQ" };
  if (paper.assessmentMode === "grade" && status.startsWith("medical")) return { ...empty, state: "medical" };
  if (paper.assessmentMode === "grade") {
    const grade = mark?.gradeValue;
    if (!grade) return { ...empty, state: "pending" };
    if (!(paper.gradeOptions ?? []).includes(grade)) return { ...empty, state: "invalid", grade: "ERR" };
    return { ...empty, grade, state: verified ? "verified" : "passed" };
  }
  const components = [
    ["theory", paper.theory ?? 80],
    ["internal", paper.internal ?? 20],
    ["practical", paper.practical ?? 0],
  ];
  const values = components.map(([field, max]) =>
    max === 0 ? 0 : typeof mark?.[field] === "number" && Number.isFinite(mark[field]) ? mark[field] : null,
  );
  if (
    components.some(([, max], index) => values[index] !== null && (values[index] < 0 || values[index] > max))
  )
    return {
      ...empty,
      total: values.reduce((sum, value) => sum + (value ?? 0), 0),
      state: "invalid",
      grade: "ERR",
    };
  if (values[0] === null && (mark?.medical || status.startsWith("medical")))
    return { ...empty, state: "medical" };
  if (status === "absent" || status === "disqualified")
    return { ...empty, state: "absent", grade: status === "absent" ? "AB" : "DQ" };
  if (values.includes(null)) return { ...empty, state: "pending" };
  const maximum = components.reduce((sum, [, max]) => sum + max, 0);
  if (maximum <= 0) return { ...empty, state: "invalid", grade: "ERR" };
  const total = values.reduce((sum, value) => sum + value, 0);
  const percentage = (total / maximum) * 100;
  const passed =
    total >= (paper.passMarks ?? maximum * 0.33) &&
    (paper.resultRules?.passCriteria !== "components" ||
      values.every(
        (value, index) => value >= (paper[["theoryPass", "internalPass", "practicalPass"][index]] ?? 0),
      ));
  const pct = rounded(percentage, paper.resultRules?.rounding);
  return {
    state: verified ? "verified" : passed ? "passed" : "failed",
    total,
    pct,
    grade: gradeFor(pct, paper.scale),
    passed,
  };
}
function overallResult(entries, rules = {}, scale) {
  // A missing descriptor or invalid component must never produce a final numeric result.
  if (entries.some(({ result }) => ["pending", "invalid", "medical"].includes(result.state) ||
    (result.state === "absent" && (rules.absentRule !== "zero" || result.grade === "DQ"))))
    return { pct: null, total: null, maximum: null, grade: "--", complete: false };
  const numeric = entries.filter(
    ({ paper, result }) => paper.assessmentMode !== "grade" && result.state !== "exempt",
  );
  if (!numeric.length)
    return {
      pct: null,
      total: null,
      maximum: null,
      grade: "--",
      complete:
        entries.length > 0 &&
        entries.every(({ result }) => !["pending", "invalid", "medical"].includes(result.state)),
    };
  if (
    numeric.some(
      ({ result }) => result.total === null && !(result.state === "absent" && rules.absentRule === "zero"),
    )
  )
    return { pct: null, total: null, maximum: null, grade: "--", complete: false };
  const total = numeric.reduce((sum, { result }) => sum + (result.total ?? 0), 0);
  const maximum = numeric.reduce(
    (sum, { paper }) => sum + paper.theory + paper.internal + (paper.practical ?? 0),
    0,
  );
  const weighted = numeric.reduce(
    (sum, { paper, result }) =>
      sum +
      (result.total === null
        ? 0
        : (result.total / (paper.theory + paper.internal + (paper.practical ?? 0))) * 100) *
        (rules.calculation === "weighted" ? (paper.weight ?? 1) : 1),
    0,
  );
  const divisor = numeric.reduce(
    (sum, { paper }) => sum + (rules.calculation === "weighted" ? (paper.weight ?? 1) : 1),
    0,
  );
  const pct = rounded(
    rules.calculation === "average" || rules.calculation === "weighted"
      ? weighted / divisor
      : (total / maximum) * 100,
    rules.rounding,
  );
  return {
    pct,
    total,
    maximum,
    grade: gradeFor(pct, scale),
    complete: entries.every(({ result }) => !["pending", "invalid", "medical"].includes(result.state)),
  };
}
module.exports = { assessMark, overallResult, gradeFor, markFingerprint };
