"use client";
// Direct Firestore writes of the portal's own records. `useCollection.create` adds the admin console's `_o` ordering key,
// which the rules' `validStaffLeave` key list does not allow, so the app-shaped documents are written as they are.
import { deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";

const ref = (col: string, id: string) => {
  const sid = currentSchoolId();
  if (!sid) throw new Error("Not signed in");
  return doc(db, "schools", sid, col, id);
};
export const setPortalDoc = (col: string, id: string, data: Record<string, unknown>, merge = false) => (merge ? setDoc(ref(col, id), data, { merge: true }) : setDoc(ref(col, id), data));
export const updatePortalDoc = (col: string, id: string, patch: Record<string, unknown>) => updateDoc(ref(col, id), patch);
export const deletePortalDoc = (col: string, id: string) => deleteDoc(ref(col, id));
