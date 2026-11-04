"use client";
import { siteUrls } from "@edvio/shared/sites";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "cn";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/shadcn/button";
import { PRODUCT } from "./content";

const LINKS = [["#product", "Product"], ["#benefits", "Benefits"], ["#how", "How it works"], ["#trust", "Trust"], ["#faq", "FAQ"]] as const;

/** Sticky top bar: translucent once the page has scrolled; a sheet menu on phones. */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={cn("sticky top-0 z-40 transition-colors", scrolled || open ? "border-b bg-background/85 backdrop-blur-md" : "bg-transparent")}>
      <div className="l-container flex h-16 items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2.5 font-heading text-lg font-semibold tracking-tight"><Logo size={32} /> {PRODUCT}</a>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {LINKS.map(([h, t]) => <a key={h} href={h} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{t}</a>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="lg" asChild><a href={`${siteUrls().admin}/login`}>Sign in</a></Button>
          <Button size="lg" asChild><a href="#demo">Book a demo</a></Button>
        </div>
        <button type="button" className="flex size-10 items-center justify-center rounded-lg md:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="l-container border-t pb-4 pt-2 md:hidden">
          {LINKS.map(([h, t]) => <a key={h} href={h} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-base">{t}</a>)}
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" asChild><a href={`${siteUrls().admin}/login`}>Sign in</a></Button>
            <Button size="lg" className="flex-1" asChild><a href="#demo" onClick={() => setOpen(false)}>Book a demo</a></Button>
          </div>
        </div>
      )}
    </header>
  );
}
