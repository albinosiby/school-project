"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

type T = { id: number; msg: string; tone: "success" | "error" };
const Ctx = createContext<(msg: string, tone?: T["tone"]) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((msg: string, tone: T["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500);
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
