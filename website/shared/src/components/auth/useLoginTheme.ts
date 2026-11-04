import { useSyncExternalStore } from "react";

type LoginTheme = "light" | "dark";
const storageKey = "edvio.login.theme";
const changeEvent = "edvio:login-theme";
let unsavedTheme: LoginTheme | undefined;

function snapshot(): LoginTheme {
  if (unsavedTheme) return unsavedTheme;
  try { return window.localStorage.getItem(storageKey) === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

/** Keep server rendering stable and remember the preference within each app's origin. */
export function useLoginTheme() {
  const theme = useSyncExternalStore(subscribe, snapshot, (): LoginTheme => "light");
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    try { window.localStorage.setItem(storageKey, next); unsavedTheme = undefined; }
    catch { unsavedTheme = next; }
    window.dispatchEvent(new Event(changeEvent));
  }
  return { theme, toggleTheme };
}
