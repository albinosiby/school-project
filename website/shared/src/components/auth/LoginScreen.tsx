"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Building2, CircleAlert, Eye, EyeOff, Layers3, LoaderCircle, LockKeyhole, Mail, Moon, ShieldCheck, Sun, UsersRound, Workflow } from "lucide-react";
import { Logo } from "../Logo";
import { CopyrightYear } from "../CopyrightYear";
import { siteUrls } from "../../lib/sites";
import styles from "./LoginScreen.module.css";
import { useLoginTheme } from "./useLoginTheme";

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** A conceptual illustration of the platform's connected domains, without simulated live data. */
function ConnectedPlatform({ school }: { school: boolean }) {
  return (
    <div className={styles.network} aria-hidden="true">
      <svg className={styles.connections} viewBox="0 0 520 216" fill="none">
        <circle cx="260" cy="108" r="84" stroke="currentColor" strokeDasharray="3 7" />
        <circle cx="260" cy="108" r="58" stroke="currentColor" />
        <path d="M260 108H412V36M260 108H412V180M260 108H83V174" stroke="currentColor" />
        <path d="M260 108H344" className={styles.connectionAccent} />
        <circle cx="344" cy="108" r="3" className={styles.connectionDot} />
        <path d="M0 108H148M372 108H520" stroke="currentColor" strokeDasharray="2 6" />
      </svg>
      <div className={styles.networkCore}><Layers3 size={31} strokeWidth={1.5} /></div>
      <div className={`${styles.networkNode} ${styles.schoolsNode}`}><Building2 size={15} /><span>{school ? "Students" : "Schools"}</span></div>
      <div className={`${styles.networkNode} ${styles.teamsNode}`}><UsersRound size={15} /><span>{school ? "Staff" : "Teams"}</span></div>
      <div className={`${styles.networkNode} ${styles.operationsNode}`}><Workflow size={15} /><span>{school ? "School office" : "Operations"}</span></div>
    </div>
  );
}

export interface LoginScreenProps {
  audience: "school" | "owner";
  onSignIn: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  blockedMessage?: string;
  onCreateAccount?: () => void;
}

/** Shared presentation and form interaction. Identity, authorization, and routing stay in each app. */
export function LoginScreen({ audience, onSignIn, onResetPassword, blockedMessage = "", onCreateAccount }: LoginScreenProps) {
  const isSchool = audience === "school";
  const { theme, toggleTheme } = useLoginTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [invalidField, setInvalidField] = useState<"email" | "password" | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [isResetting, setResetting] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const busy = isLoading || isResetting;
  const message = error || blockedMessage;

  const clearFeedback = () => { setError(""); setInfo(""); setInvalidField(null); };
  const invalid = (field: "email" | "password", message: string) => {
    setInvalidField(field); setError(message);
    (field === "email" ? emailInput : passwordInput).current?.focus();
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    clearFeedback();
    if (!email.trim()) return invalid("email", "Enter your email address.");
    if (!validEmail(email)) return invalid("email", "Enter a valid email address.");
    if (!password) return invalid("password", "Enter your password.");
    setLoading(true);
    try { await onSignIn(email.trim(), password); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not sign in. Please try again."); }
    finally { setLoading(false); }
  }

  async function forgotPassword() {
    if (busy) return;
    clearFeedback();
    if (!validEmail(email)) return invalid("email", "Enter your email above first.");
    setResetting(true);
    try { await onResetPassword(email.trim()); setInfo("Password reset email sent. Check your inbox."); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not send reset email. Please try again."); }
    finally { setResetting(false); }
  }

  return (
    <div className={`${styles.page} ${isSchool ? styles.school : ""}`} data-theme={theme}>
      <header className={styles.header}>
        <div className={styles.brand} aria-label={isSchool ? "Edvio School" : "Edvio Platform"}>
          <span className={styles.logo}><Logo size={30} /></span>
          <span className={styles.wordmark}>edvio<span className={styles.brandDot}>.</span></span>
          <span className={styles.brandDivider} />
          <span className={styles.brandLabel}>{isSchool ? "School" : "Platform"}</span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.privateAccess}><LockKeyhole size={13} aria-hidden="true" /><span>Private workspace</span></span>
          <button type="button" onClick={toggleTheme} className={styles.themeToggle}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
            {theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
            <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.brandPanel} aria-labelledby="platform-heading">
          <p className={styles.eyebrow}><span />{isSchool ? "A connected school. A clearer day." : "A clearer view. A stronger network."}</p>
          <h2 id="platform-heading" className={styles.headline}>{isSchool ? "Your school." : "Big picture."}<br /><span>{isSchool ? "In sync." : "Every detail."}</span></h2>
          <p className={styles.brandDescription}>{isSchool ? "Students, staff, and everyday operations. Connected in one place, so your school can move forward." : "Your schools, teams, and operations. Connected in one place, so you can focus on what comes next."}</p>
          <ConnectedPlatform school={isSchool} />
          <p className={styles.platformCaption}><span />One platform. Moving education forward.</p>
        </section>

        <div className={styles.formColumn}>
          <section className={styles.card} aria-labelledby="login-heading">
            <p className={styles.formEyebrow}><ShieldCheck size={15} aria-hidden="true" />{isSchool ? "School administration" : "Owner console"}</p>
            <h1 id="login-heading" className={styles.formTitle}>Welcome back.</h1>
            <p id="login-description" className={styles.formDescription}>{isSchool ? "Sign in to manage your school." : "Sign in to manage your Edvio platform."}</p>

            <form onSubmit={submit} noValidate aria-describedby="login-description" className={styles.form}>
              <div className={styles.field}>
                <label htmlFor={`${audience}-email`}>Email address</label>
                <div className={styles.inputWrapper}>
                  <Mail size={17} className={styles.inputIcon} aria-hidden="true" />
                  <input ref={emailInput} id={`${audience}-email`} name="email" type="email" autoComplete="username" required
                    value={email} onChange={(event) => { setEmail(event.target.value); clearFeedback(); }}
                    placeholder={isSchool ? "principal@school.edu" : "owner@edvio.com"} disabled={busy} aria-invalid={invalidField === "email"}
                    aria-describedby={invalidField === "email" ? "login-feedback" : undefined} className={styles.input} />
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.passwordLabel}>
                  <label htmlFor={`${audience}-password`}>Password</label>
                  <button type="button" onClick={forgotPassword} disabled={busy} className={styles.textButton}>
                    {isResetting ? "Sending reset link…" : "Forgot password?"}
                  </button>
                </div>
                <div className={styles.inputWrapper}>
                  <LockKeyhole size={17} className={styles.inputIcon} aria-hidden="true" />
                  <input ref={passwordInput} id={`${audience}-password`} name="password" type={showPassword ? "text" : "password"}
                    autoComplete="current-password" required value={password}
                    onChange={(event) => { setPassword(event.target.value); clearFeedback(); }}
                    placeholder="Enter your password" disabled={busy} aria-invalid={invalidField === "password"}
                    aria-describedby={invalidField === "password" ? "login-feedback" : undefined}
                    className={`${styles.input} ${styles.passwordInput}`} />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} disabled={busy}
                    aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
                    aria-controls={`${audience}-password`} className={styles.revealButton}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {message && <div id="login-feedback" role="alert" className={styles.feedback}><CircleAlert size={16} aria-hidden="true" /><span>{message}</span></div>}
              {info && <div role="status" className={`${styles.feedback} ${styles.info}`}><Mail size={16} aria-hidden="true" /><span>{info}</span></div>}

              <button type="submit" disabled={busy} aria-busy={isLoading} className={styles.submit}>
                <span>{isLoading ? "Signing in…" : "Sign in"}</span>
                {isLoading ? <LoaderCircle size={18} className={styles.spinner} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
              </button>
            </form>

            {isSchool && onCreateAccount && <div className={styles.registration}>
              <span>New to Edvio?</span>
              <button type="button" onClick={onCreateAccount} disabled={busy} className={styles.createAccount}>Create Account <ArrowUpRight size={13} aria-hidden="true" /></button>
            </div>}

            <div className={styles.accessNote}><LockKeyhole size={13} aria-hidden="true" /><span>{isSchool ? "For authorized school administrators." : "For authorized platform owners only."}</span></div>
          </section>
          <p className={styles.schoolLogin}>{isSchool ? "Looking for platform administration?" : "Here to manage your school?"} <a href={`${isSchool ? siteUrls().owner : siteUrls().admin}/login`}>{isSchool ? "Owner console" : "School admin login"} <ArrowUpRight size={13} aria-hidden="true" /></a></p>
        </div>
      </main>

      <footer className={styles.footer}>
        <span>© <CopyrightYear /> Edvio. All rights reserved.</span>
        <span>Built with purpose. <span className={styles.footerBrand}>Tatos Technologies.</span></span>
      </footer>
    </div>
  );
}
