"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AuthUser } from "../../lib/db";
import { changePasswordSchema, profileSchema, type ChangePasswordInput, type ProfileInput } from "../../lib/auth-schemas";
import { apiFetch } from "../../lib/api-client";

type FieldErrors = Record<string, string>;

function formatBangladeshDate(value: string) {
  return new Intl.DateTimeFormat("en-BD", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function getPasswordChecks(password: string) {
  return [
    { label: "8+ characters", valid: password.length >= 8 },
    { label: "Uppercase", valid: /[A-Z]/.test(password) },
    { label: "Lowercase", valid: /[a-z]/.test(password) },
    { label: "Number", valid: /[0-9]/.test(password) },
    { label: "Special character", valid: /[^A-Za-z0-9]/.test(password) },
  ];
}

function Icon({ name }: { name: "pulse" | "arrow" | "close" }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "pulse") return <svg {...common}><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

export default function ProfileSettings({ initialUser }: { initialUser: AuthUser }) {
  const [user, setUser] = useState(initialUser);
  const [profile, setProfile] = useState<ProfileInput>({ username: initialUser.username, email: initialUser.email, mobile: initialUser.mobile });
  const [passwords, setPasswords] = useState<ChangePasswordInput>({ currentPassword: "", password: "", confirmPassword: "" });
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const passwordChecks = useMemo(() => getPasswordChecks(passwords.password), [passwords.password]);
  const passwordMatch = passwords.confirmPassword.length > 0 && passwords.password === passwords.confirmPassword;

  const updateProfileField = (field: keyof ProfileInput, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setProfileErrors((current) => ({ ...current, [field]: "" }));
    setProfileError("");
    setProfileSuccess("");
  };

  const updatePasswordField = (field: keyof ChangePasswordInput, value: string) => {
    setPasswords((current) => ({ ...current, [field]: value }));
    setPasswordErrors((current) => ({ ...current, [field]: "" }));
    setPasswordError("");
    setPasswordSuccess("");
  };

  const applyFieldErrors = (issues: Array<{ path: PropertyKey[]; message: string }>) => {
    const nextErrors: FieldErrors = {};
    issues.forEach((issue) => { const field = issue.path[0]; if (typeof field === "string" && !nextErrors[field]) nextErrors[field] = issue.message; });
    return nextErrors;
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileErrors({});
    setProfileError("");
    setProfileSuccess("");
    const result = profileSchema.safeParse(profile);
    if (!result.success) { setProfileErrors(applyFieldErrors(result.error.issues)); setProfileError("Please review the highlighted fields."); return; }
    setIsSavingProfile(true);
    try {
      const response = await apiFetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data) });
      const payload = await response.json();
      if (!response.ok) { setProfileError(payload.error || "Unable to update your profile."); setProfileErrors(payload.fieldErrors || {}); return; }
      setUser(payload.user);
       setProfile({ username: payload.user.username, email: payload.user.email, mobile: payload.user.mobile });
      setProfileSuccess("Profile details updated successfully.");
    } catch { setProfileError("We could not reach the server. Please try again."); }
    finally { setIsSavingProfile(false); }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordErrors({});
    setPasswordError("");
    setPasswordSuccess("");
    const result = changePasswordSchema.safeParse(passwords);
    if (!result.success) { setPasswordErrors(applyFieldErrors(result.error.issues)); setPasswordError("Please review the highlighted fields."); return; }
    setIsChangingPassword(true);
    try {
      const response = await apiFetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data) });
      const payload = await response.json();
      if (!response.ok) { setPasswordError(payload.error || "Unable to change your password."); setPasswordErrors(payload.fieldErrors || {}); return; }
      setPasswords({ currentPassword: "", password: "", confirmPassword: "" });
      setPasswordSuccess("Password changed successfully.");
    } catch { setPasswordError("We could not reach the server. Please try again."); }
    finally { setIsChangingPassword(false); }
  };

  return (
    <main className="auth-shell profile-page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="profile-page">
        <header className="profile-page-nav"><a className="profile-brand" href="/"><span className="brand-mark"><Icon name="pulse" /></span><span><small>Operations console</small><strong>PulseDesk</strong></span></a><a className="back-link" href="/">Back to workspace <Icon name="arrow" /></a></header>
        <div className="profile-page-heading"><p className="eyebrow gradient-eyebrow">Account settings</p><h1>Your profile</h1><p>Update your contact details and keep your workspace access secure.</p></div>
        <div className="settings-layout">
          <section className="settings-card"><div className="settings-card-header"><div><h2>Profile information</h2><p>These details are used for your PulseDesk account.</p></div><span className="profile-avatar">{user.email.slice(0, 2).toUpperCase()}</span></div>
            {profileError && <div className="settings-alert error" role="alert">{profileError}</div>}{profileSuccess && <div className="settings-alert success" role="status">{profileSuccess}</div>}
             <form className="settings-form" onSubmit={handleProfileSubmit} noValidate><label>Username<input autoComplete="username" value={profile.username} onChange={(event) => updateProfileField("username", event.target.value)} aria-invalid={Boolean(profileErrors.username)} />{profileErrors.username && <small className="field-error">{profileErrors.username}</small>}</label><label>Email address<input type="email" value={profile.email} onChange={(event) => updateProfileField("email", event.target.value)} aria-invalid={Boolean(profileErrors.email)} />{profileErrors.email && <small className="field-error">{profileErrors.email}</small>}</label><label>Mobile number<input type="tel" value={profile.mobile} onChange={(event) => updateProfileField("mobile", event.target.value)} aria-invalid={Boolean(profileErrors.mobile)} />{profileErrors.mobile && <small className="field-error">{profileErrors.mobile}</small>}</label><div className="settings-meta">Member since {formatBangladeshDate(user.createdAt)}</div><button className="primary-button settings-submit" type="submit" disabled={isSavingProfile}>{isSavingProfile ? "Saving changes…" : "Save profile"}<Icon name="arrow" /></button></form>
          </section>
          <section className="settings-card"><div className="settings-card-header"><div><h2>Change password</h2><p>Use a strong password you do not reuse elsewhere.</p></div><span className="security-orb">✦</span></div>
            {passwordError && <div className="settings-alert error" role="alert">{passwordError}</div>}{passwordSuccess && <div className="settings-alert success" role="status">{passwordSuccess}</div>}
            <form className="settings-form" onSubmit={handlePasswordSubmit} noValidate><label>Current password<input type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(event) => updatePasswordField("currentPassword", event.target.value)} aria-invalid={Boolean(passwordErrors.currentPassword)} />{passwordErrors.currentPassword && <small className="field-error">{passwordErrors.currentPassword}</small>}</label><label>New password<input type="password" autoComplete="new-password" value={passwords.password} onChange={(event) => updatePasswordField("password", event.target.value)} aria-invalid={Boolean(passwordErrors.password)} />{passwordErrors.password && <small className="field-error">{passwordErrors.password}</small>}</label><div className="password-checks settings-password-checks">{passwordChecks.map((check) => <span key={check.label} className={check.valid ? "valid" : ""}><span>{check.valid ? "✓" : "○"}</span>{check.label}</span>)}</div><label>Confirm new password<input type="password" autoComplete="new-password" value={passwords.confirmPassword} onChange={(event) => updatePasswordField("confirmPassword", event.target.value)} aria-invalid={Boolean(passwordErrors.confirmPassword || (passwords.confirmPassword.length > 0 && !passwordMatch))} />{passwordErrors.confirmPassword && <small className="field-error">{passwordErrors.confirmPassword}</small>}<small className={`match-status ${passwords.confirmPassword ? passwordMatch ? "valid" : "invalid" : ""}`}><span>{passwords.confirmPassword ? passwordMatch ? "✓" : "!" : "○"}</span>{passwords.confirmPassword ? passwordMatch ? "Passwords match" : "Passwords do not match" : "Waiting for confirmation"}</small></label><button className="primary-button settings-submit" type="submit" disabled={isChangingPassword}>{isChangingPassword ? "Updating password…" : "Change password"}<Icon name="arrow" /></button></form>
          </section>
        </div>
      </section>
    </main>
  );
}
