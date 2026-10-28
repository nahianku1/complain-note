"use client";

import { FormEvent, useMemo, useState } from "react";
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from "../../lib/auth-schemas";

type AuthMode = "login" | "signup";
type AuthValues = LoginInput & Partial<SignupInput>;
type FieldErrors = Record<string, string>;

const initialValues: AuthValues = {
  identifier: "",
  username: "",
  email: "",
  mobile: "",
  password: "",
  confirmPassword: "",
};

function getPasswordChecks(password: string) {
  return [
    { label: "8+ characters", valid: password.length >= 8 },
    { label: "Uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "Lowercase letter", valid: /[a-z]/.test(password) },
    { label: "Number", valid: /[0-9]/.test(password) },
    { label: "Special character", valid: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const isSignup = mode === "signup";
  const [values, setValues] = useState<AuthValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordChecks = useMemo(() => getPasswordChecks(values.password || ""), [values.password]);
  const hasConfirmPassword = Boolean(values.confirmPassword);
  const passwordsMatch = hasConfirmPassword && values.password === values.confirmPassword;

  const updateField = (field: keyof AuthValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setServerError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError("");
    setFieldErrors({});
    const schema = isSignup ? signupSchema : loginSchema;
    const result = schema.safeParse(values);

    if (!result.success) {
      const nextErrors: FieldErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !nextErrors[field]) nextErrors[field] = issue.message;
      });
      setFieldErrors(nextErrors);
      setServerError("Please review the highlighted fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const payload = await response.json();
      if (!response.ok) {
        setServerError(payload.error || "Something went wrong. Please try again.");
        setFieldErrors(payload.fieldErrors || {});
        return;
      }
      window.location.assign(isSignup ? "/login" : "/");
    } catch {
      setServerError("We could not reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="auth-layout">
        <div className="auth-brand-panel">
           <div className="brand-lockup auth-brand-lockup"><div className="brand-mark"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6" /></svg></div><div><p className="eyebrow">Operations console</p><h1>TicketDesk</h1></div></div>
          <div className="auth-hero-copy"><p className="eyebrow gradient-eyebrow">Local-first ISP operations</p><h2>{isSignup ? "Turn customer tickets into action." : "Welcome back to your network desk."}</h2><p>Keep every ticket, context, and resolution close to the team that responds.</p></div>
          <div className="auth-benefits"><div><span className="benefit-icon">✦</span><span><strong>Focused workspace</strong><small>See the network context behind every ticket.</small></span></div><div><span className="benefit-icon">⌁</span><span><strong>Private by design</strong><small>Your local operations data stays on this device.</small></span></div></div>
        </div>

        <section className="auth-card" aria-labelledby="auth-title">
           <div className="auth-card-header"><p className="eyebrow gradient-eyebrow">{isSignup ? "Create your workspace access" : "Secure workspace access"}</p><h2 id="auth-title">{isSignup ? "Create an account" : "Sign in to TicketDesk"}</h2><p>{isSignup ? "Set up your operator profile in a few seconds." : "Enter your details to continue to your tickets."}</p></div>
          {serverError && <div className="auth-alert" role="alert"><span className="auth-alert-icon">!</span><span>{serverError}</span></div>}
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {isSignup ? <>
              <label><span>Username<span className="field-required">*</span></span><input autoComplete="username" value={values.username} onChange={(event) => updateField("username", event.target.value)} placeholder="network_operator" aria-invalid={Boolean(fieldErrors.username)} />{fieldErrors.username && <small className="field-error">{fieldErrors.username}</small>}</label>
              <label><span>Email address<span className="field-required">*</span></span><input type="email" autoComplete="email" value={values.email} onChange={(event) => updateField("email", event.target.value)} placeholder="you@company.com" aria-invalid={Boolean(fieldErrors.email)} />{fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}</label>
              <label><span>Mobile number<span className="field-required">*</span></span><input type="tel" autoComplete="tel" value={values.mobile} onChange={(event) => updateField("mobile", event.target.value)} placeholder="01711 456 220" aria-invalid={Boolean(fieldErrors.mobile)} />{fieldErrors.mobile && <small className="field-error">{fieldErrors.mobile}</small>}</label>
            </> : <label><span>Email or mobile number<span className="field-required">*</span></span><input autoComplete="username" value={values.identifier} onChange={(event) => updateField("identifier", event.target.value)} placeholder="you@company.com or 01711 456 220" aria-invalid={Boolean(fieldErrors.identifier)} />{fieldErrors.identifier && <small className="field-error">{fieldErrors.identifier}</small>}</label>}
            <label><span>Password<span className="field-required">*</span></span><input type="password" autoComplete={isSignup ? "new-password" : "current-password"} value={values.password} onChange={(event) => updateField("password", event.target.value)} placeholder="Enter your password" aria-invalid={Boolean(fieldErrors.password)} />{fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}</label>
            {isSignup && <>
              <div className="password-checks" aria-label="Password requirements">{passwordChecks.map((check) => <span key={check.label} className={check.valid ? "valid" : ""}><span>{check.valid ? "✓" : "○"}</span>{check.label}</span>)}</div>
              <label><span>Confirm password<span className="field-required">*</span></span><input type="password" autoComplete="new-password" value={values.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} placeholder="Re-enter your password" aria-invalid={Boolean(fieldErrors.confirmPassword || (hasConfirmPassword && !passwordsMatch))} />{fieldErrors.confirmPassword && <small className="field-error">{fieldErrors.confirmPassword}</small>}<small className={`match-status ${hasConfirmPassword ? passwordsMatch ? "valid" : "invalid" : ""}`} aria-live="polite"><span>{hasConfirmPassword ? passwordsMatch ? "✓" : "!" : "○"}</span>{hasConfirmPassword ? passwordsMatch ? "Passwords match" : "Passwords do not match" : "Waiting for confirmation"}</small></label>
            </>}
            <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? (isSignup ? "Creating account…" : "Signing in…") : isSignup ? "Create account" : "Sign in"}<span>→</span></button>
          </form>
           <p className="auth-switch">{isSignup ? "Already have an account?" : "New to TicketDesk?"} <a href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</a></p>
          <p className="auth-privacy">By continuing, you agree to keep your workspace credentials private.</p>
        </section>
      </section>
    </main>
  );
}
