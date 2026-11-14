const { getStorage } = require("firebase-admin/storage");
const { HttpsError } = require("firebase-functions/v2/https");
const documentTypes = require("./staffDocumentTypes.json");

const maxBytes = 10 * 1024 * 1024;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const signatures = {
  "application/pdf": Buffer.from("%PDF-"),
  "image/jpeg": Buffer.from([255, 216, 255]),
  "image/png": Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
};
const documentChanged = () => new HttpsError("aborted", "Another admin changed this document. Refresh the page before replacing it.");

async function existingMetadata(file) {
  try {
    const [metadata] = await file.getMetadata();
    return metadata;
  } catch (error) {
    if (error.code !== 404) throw error;
    return null;
  }
}

function prefix(staff) {
  return `${staff.parent.parent.path}/staff-documents/${staff.id}/`;
}

function documentSummary(file) {
  const { metadata } = file;
  return {
    id: file.name.split("/").at(-1),
    generation: String(metadata.generation),
    category: metadata.metadata.category,
    name: metadata.metadata.originalName,
    uploadedAt: metadata.updated,
  };
}

function documentData(input) {
  const { category, contentType, content, name } = input;
  if (!Object.hasOwn(documentTypes, category) || typeof name !== "string" || !name.trim() ||
      name.length > 255 || /[\u0000-\u001f\u007f]/.test(name) || /[\\/]/.test(name)) {
    throw new HttpsError("invalid-argument", "Choose a document category and a valid file name.");
  }
  if (!Object.hasOwn(signatures, contentType) || typeof content !== "string" ||
      content.length > Math.ceil(maxBytes / 3) * 4) {
    throw new HttpsError("invalid-argument", "Choose a PDF, JPEG or PNG file under 10 MB.");
  }
  const bytes = Buffer.from(content, "base64");
  const signature = signatures[contentType];
  if (bytes.length >= maxBytes || !bytes.subarray(0, signature.length).equals(signature) ||
      bytes.toString("base64") !== content) {
    throw new HttpsError("invalid-argument", "The document is too large or does not match its file format.");
  }
  return bytes;
}

async function staffDocuments(staff, input) {
  const { action, id, generation, uploadId } = input;
  const bucket = getStorage().bucket();
  const folder = prefix(staff);

  if (action === "list") {
    const [files] = await bucket.getFiles({ prefix: folder });
    return { documents: files.map(documentSummary).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)) };
  }

  const existing = action === "read" || id !== undefined;
  if (existing && (typeof id !== "string" || !uuid.test(id) ||
      typeof generation !== "string" || !/^\d{1,20}$/.test(generation))) {
    throw new HttpsError("invalid-argument", "Choose a saved document.");
  }
  if (action === "save" && (typeof uploadId !== "string" || !uuid.test(uploadId))) {
    throw new HttpsError("invalid-argument", "Choose a document to upload.");
  }
  const file = bucket.file(folder + (existing ? id : uploadId));
  try {
    if (action === "read") {
      const current = await existingMetadata(file);
      if (!current || String(current.generation) !== generation) {
        throw new HttpsError("not-found", "This document has changed or was removed. Refresh the page.");
      }
      const version = bucket.file(file.name, { generation });
      if (!Object.hasOwn(signatures, current.contentType) || Number(current.size) >= maxBytes) {
        throw new HttpsError("failed-precondition", "This document format or size is unsupported.");
      }
      const [bytes] = await version.download();
      return { contentType: current.contentType, content: bytes.toString("base64") };
    }

    const bytes = documentData(input);
    const current = await existingMetadata(file);
    if (current?.metadata?.uploadId === uploadId) return { document: documentSummary(file) };
    if (existing ? !current || String(current.generation) !== generation : current) throw documentChanged();
    await file.save(bytes, {
      resumable: false,
      metadata: {
        contentType: input.contentType,
        cacheControl: "private, no-store",
        metadata: { category: input.category, originalName: input.name.trim(), uploadId },
      },
      preconditionOpts: { ifGenerationMatch: existing ? generation : 0 },
    });
    if (!(await staff.get()).exists) {
      await file.delete({ ignoreNotFound: true });
      throw new HttpsError("not-found", "This staff member could not be found.");
    }
    await file.getMetadata();
    return { document: documentSummary(file) };
  } catch (error) {
    if (error.code === 404) throw new HttpsError("not-found", "This document has changed or was removed. Refresh the page.");
    if (error.code === 412) {
      const current = await existingMetadata(file);
      if (current?.metadata?.uploadId === uploadId) return { document: documentSummary(file) };
      throw documentChanged();
    }
    throw error;
  }
}

async function deleteStaffDocuments(staff) {
  await getStorage().bucket().deleteFiles({ prefix: prefix(staff), force: true });
}

module.exports = { staffDocuments, deleteStaffDocuments };
