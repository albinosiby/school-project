"use client";
import { useCollection } from "./useCollection";

type Me = { id: string; name: string; title?: string };

/** The signed-in admin's display name (the school's `me` profile doc), for "approved by" / author fields. */
export function useMyName() {
  const me = useCollection<Me>("me").rows[0];
  return { name: me?.name || "School Admin", title: me?.title };
}
