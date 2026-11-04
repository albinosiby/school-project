"use client";
/**
 * Scroll-triggered motion helpers for the landing page (motion/react). Every helper honours prefers-reduced-motion:
 * with it on, elements render in their final state and counters show the final number.
 */
import { animate, motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts a block in when it scrolls into view (once). */
export function Reveal({ children, className, delay = 0, y = 28, as = "div" }: { children: ReactNode; className?: string; delay?: number; y?: number; as?: "div" | "section" | "li" | "p" | "h2" | "h3" }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

export const staggerParent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
export const staggerChild: Variants = { hidden: { opacity: 0, y: 24, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE } } };

/** A list whose children appear one after another; use with <StaggerItem>. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={reduce ? undefined : staggerParent} initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, margin: "0px 0px -8% 0px" }}>
      {children}
    </motion.div>
  );
}
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} variants={reduce ? undefined : staggerChild}>{children}</motion.div>;
}

/** Counts from 0 to `value` the first time it is on screen. */
export function Counter({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, value, { duration: 1.6, ease: EASE, onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, reduce, value]);
  const shown = reduce ? value : n; // reduced motion: the final number, no count-up
  return <span ref={ref} className={className} aria-label={`${value.toLocaleString("en-IN")}${suffix}`}>{shown.toLocaleString("en-IN")}{suffix}</span>;
}
