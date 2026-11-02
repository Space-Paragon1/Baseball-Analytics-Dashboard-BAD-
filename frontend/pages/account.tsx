import { FormEvent, ReactNode, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Alert, AuthGate, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/api";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "../utils/passwords";

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Account" subtitle="Your profile and password." />
      <AuthGate action="manage your account">
        <AccountDetails />
      </AuthGate>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
      <dt className="muted">{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-slate-100 truncate">{children}</dd>
    </div>
  );
}

function AccountDetails() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-2 max-w-4xl items-start">
      <section className="card p-6">
        <h2 className="card-title mb-3">Profile</h2>
        <dl className="text-sm">
          <Row label="Username">{user.username}</Row>
          <Row label="Email">{user.email}</Row>
          <Row label="Role">
            {user.is_admin ? (
              <span className="badge-purple gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </span>
            ) : (
              <span className="badge-gray">User</span>
            )}
          </Row>
        </dl>
        <p className="text-xs muted mt-4">
          {user.is_admin
            ? "As an admin you can delete records, upload data, import MLB games and manage users."
            : "You can add and edit records and score games. Ask an admin if you need more access."}
        </p>
      </section>
      <ChangePasswordForm />
    </div>
  );
}

function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const { addToast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setDone(false);
    const problem = passwordProblem(next, confirm, current);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      addToast("Password changed.", "success");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't change the password."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="card-title mb-1 flex items-center gap-2">
        <KeyRound className="w-4 h-4" /> Change password
      </h2>
      <p className="text-xs muted mb-4">You&apos;ll stay signed in here. Any other devices will be signed out.</p>
      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      {done && (
        <div className="mb-4">
          <Alert kind="success">Password changed. Other devices have been signed out.</Alert>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="field-label">Current password</span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
            className="input-field w-full"
          />
        </label>
        <label className="block">
          <span className="field-label">New password</span>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            className="input-field w-full"
          />
        </label>
        <label className="block">
          <span className="field-label">Confirm new password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="input-field w-full"
          />
        </label>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy && <Spinner />}
          {busy ? "Saving..." : "Change password"}
        </button>
      </form>
    </section>
  );
}
