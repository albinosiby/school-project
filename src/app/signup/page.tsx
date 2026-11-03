"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, Lock, Building2, ArrowRight, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, Card, Field, Input } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { CopyrightYear } from "@/components/CopyrightYear";

export default function SignUpPage() {
  const router = useRouter();
  const { signup, user } = useAuth();
  const [justSignedUp, setJustSignedUp] = useState(false);
  useEffect(() => { if (user && !justSignedUp) router.replace("/dashboard"); }, [user, justSignedUp, router]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    } else if (password.length > 128) {
      newErrors.password = "Password must be at most 128 characters";
    }

    if (!confirm) {
      newErrors.confirm = "Confirm your password";
    } else if (password && confirm !== password) {
      newErrors.confirm = "Passwords do not match";
    }

    if (!organizationName.trim()) {
      newErrors.organizationName = "Organization name is required";
    } else if (organizationName.trim().length < 2) {
      newErrors.organizationName = "Organization name must be at least 2 characters";
    } else if (organizationName.trim().length > 120) {
      newErrors.organizationName = "Organization name must be at most 120 characters";
    }

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = validateForm();
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsLoading(true);

    try {
      setJustSignedUp(true);
      await signup(email, password, organizationName);
      router.push("/onboarding/setup");
    } catch (err) {
      setJustSignedUp(false);
      setErrors({
        submit: err instanceof Error ? err.message : "Sign up failed",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field: string) => {
    setErrors((prev) => ({
      ...prev,
      [field]: "",
      submit: "",
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-container via-surface to-surface-container flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-24 rounded-3xl bg-surface-container-lowest shadow-lg mb-4">
            <Logo size={80} />
          </div>
          <h1 className="t-display text-on-surface">Get Started</h1>
          <p className="t-body-md text-on-surface-variant mt-2">Create your school admin account</p>
        </div>

        {/* Sign Up Card */}
        <Card className="p-8 shadow-xl">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Organization Name Field */}
            <div>
              <Field label="Organization Name" required error={errors.organizationName}>
                <div className="relative">
                  <Building2 aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-on-surface-variant opacity-50" />
                  <Input
                    type="text"
                    value={organizationName}
                    onChange={(e) => {
                      setOrganizationName(e.target.value);
                      handleFieldChange("organizationName");
                    }}
                    placeholder="e.g. Springfield Public School"
                    className="pl-10"
                  />
                </div>
              </Field>
            </div>

            {/* Email Field */}
            <div>
              <Field label="Email Address" required error={errors.email}>
                <div className="relative">
                  <Mail aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-on-surface-variant opacity-50" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      handleFieldChange("email");
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
              <Field label="Password" required error={errors.password}>
                <div className="relative">
                  <Lock aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-on-surface-variant opacity-50" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      handleFieldChange("password");
                    }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="pl-10"
                  />
                </div>
              </Field>
              <p className="text-xs text-on-surface-variant mt-1">Minimum 6 characters</p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <Field label="Confirm Password" required error={errors.confirm}>
                <div className="relative">
                  <Lock aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-on-surface-variant opacity-50" />
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      handleFieldChange("confirm");
                    }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="pl-10"
                  />
                </div>
              </Field>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="rounded-lg bg-error-container p-3 text-sm text-error flex items-start gap-2">
                <span className="text-lg leading-none" aria-hidden>⚠️</span>
                <span role="alert">{errors.submit}</span>
              </div>
            )}

            {/* Sign Up Button */}
            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create Account"}
              <ArrowRight size={18} className="ml-2" />
            </Button>

            {/* Terms Info */}
            <p className="text-xs text-on-surface-variant text-center">
              By creating an account, you agree to our Terms of Service and Privacy Policy
            </p>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-surface px-2 text-on-surface-variant">Already have an account?</span>
              </div>
            </div>

            {/* Sign In Button */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => router.push("/login")}
            >
              <ArrowLeft size={18} className="mr-2" />
              Back to Sign In
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
