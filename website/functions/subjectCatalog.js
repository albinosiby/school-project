// This catalog is shared by the dashboard and the staff profile functions.
const subjectName = (value) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const subjectKey = (value) => subjectName(value).toLowerCase();
const subjectCatalogId = (subject) => subject.id || (subject.departmentId
  ? `legacy:${JSON.stringify([subject.departmentId, subjectKey(subject.name)])}` : "");
const unique = (values) => [...new Set(values.filter((value) => typeof value === "string" && value))];

function normalizeSubjects(entries) {
  const subjects = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const name = subjectName(entry?.name);
    if (!name) continue;
    const key = subjectKey(name);
    const id = subjectCatalogId(entry);
    const departmentIds = unique([...(Array.isArray(entry.departmentIds) ? entry.departmentIds : []), entry.departmentId]);
    const aliases = unique([...(Array.isArray(entry.aliasIds) ? entry.aliasIds : []), id]);
    const existing = subjects.get(key);
    if (existing) {
      if (!existing.id && id) existing.id = id;
      existing.active ||= entry.active === true;
      existing.departmentIds = unique([...existing.departmentIds, ...departmentIds]);
      existing.aliasIds = unique([...existing.aliasIds, ...aliases]).filter((alias) => alias !== existing.id);
    } else {
      subjects.set(key, {
        ...(id ? { id } : {}), name, active: entry.active === true, departmentIds,
        aliasIds: aliases.filter((alias) => alias !== id),
      });
    }
  }
  return [...subjects.values()];
}

function subjectForSelection(subjects, name, id) {
  return id
    ? subjects.find((subject) => subjectCatalogId(subject) === id || subject.aliasIds?.includes(id))
    : subjects.find((subject) => subjectKey(subject.name) === subjectKey(name));
}

module.exports = { subjectName, subjectKey, subjectCatalogId, normalizeSubjects, subjectForSelection };
