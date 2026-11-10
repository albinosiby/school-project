"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

type T = { id: number; msg: string; tone: "success" | "error" };
const Ctx = createContext<(msg: string, tone?: T["tone"]) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach(clearTimeout);
      active.clear();
    };
  }, []);
  const push = useCallback((msg: string, tone: T["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, tone }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setItems((x) => x.filter((i) => i.id !== id));
    }, 3500);
    timers.current.add(timer);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 rounded-lg bg-inverse-surface px-4 py-3 text-sm text-inverse-on-surface shadow-pop">
            {i.tone === "success" ? <CheckCircle2 size={16} className="text-success" /> : <AlertCircle size={16} className="text-error" />}
            {i.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
