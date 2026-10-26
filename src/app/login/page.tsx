"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, Card, Field, Input } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { CopyrightYear } from "@/components/CopyrightYear";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, resetPassword, blockedMessage } = useAuth();
  const [info, setInfo] = useState("");
  useEffect(() => { if (user) router.replace("/dashboard"); }, [user, router]);
  const forgot = async () => {
    setError(""); setInfo("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter your email above first.");
    try { await resetPassword(email); setInfo("Password reset email sent. Check your inbox."); } catch (e) { setError(e instanceof Error ? e.message : "Could not send reset email"); }
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-container via-surface to-surface-container flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-24 rounded-3xl bg-surface-container-lowest shadow-lg mb-4">
            <Logo size={80} />
          </div>
          <h1 className="t-display text-on-surface">Welcome Back</h1>
          <p className="t-body-md text-on-surface-variant mt-2">School Administration Platform</p>
        </div>

        {/* Login Card */}
        <Card className="p-8 shadow-xl">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Email Field */}
            <div>
              <Field label="Email Address" required>
                <div className="relative">
                  <Mail aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-on-surface-variant opacity-50" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="principal@school.edu"
                    autoComplete="email"
                    className="pl-10"
                  />
                </div>
              </Field>
            </div>

            {/* Password Field */}
            <div>
              <Field label="Password" required>
                <div className="relative">
                  <Lock aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-on-surface-variant opacity-50" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pl-10"
                  />
                </div>
              </Field>
            </div>

            {/* Error Message */}
            {(error || blockedMessage) && (
              <div className="rounded-lg bg-error-container p-3 text-sm text-error flex items-start gap-2">
                <span className="text-lg leading-none" aria-hidden>⚠️</span>
                <span role="alert">{error || blockedMessage}</span>
              </div>
            )}

            {info && <div role="status" className="rounded-lg bg-success-container p-3 text-sm text-success">{info}</div>}
            <button type="button" onClick={forgot} className="-mt-2 cursor-pointer text-sm text-secondary hover:underline">Forgot password?</button>

            {/* Login Button */}
            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
              <ArrowRight size={18} className="ml-2" />
            </Button>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-surface px-2 text-on-surface-variant">New to the platform?</span>
              </div>
            </div>

            {/* Sign Up Button */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => router.push("/signup")}
            >
              Create Account
            </Button>
          </form>

        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-on-surface-variant mt-6">
          © <CopyrightYear /> School Admin Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}
