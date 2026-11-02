import { FormEvent, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Alert, AuthCard, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useAsync } from "../hooks/useAsync";
import { fetchAuthConfig, getErrorMessage } from "../utils/api";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { addToast } = useToast();
  const config = useAsync(() => fetchAuthConfig(), []);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await register(username, email, password);
      addToast(user.is_admin ? "Account created. You're the admin." : "Account created. You're signed in.", "success");
      router.push("/");
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed."));
    } finally {
      setLoading(false);
    }
  };

  if (config.data && !config.data.registration_open) {
    return (
      <AuthCard icon={<UserPlus className="w-5 h-5" />} title="Create account">
        <p className="text-sm muted">Sign-ups are closed on this dashboard. Ask the admin for an account.</p>
        <Link href="/login" className="btn-primary mt-5 w-full">
          Sign in instead
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard icon={<UserPlus className="w-5 h-5" />} title="Create account">
      {config.data && !config.data.has_users && (
        <div className="alert-warning mb-4">You&apos;re the first user, so this account will be the admin.</div>
      )}
      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="field-label">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="username"
            pattern="[A-Za-z0-9_.\-]{3,32}"
            title="3-32 letters, numbers, dots, dashes or underscores"
            className="input-field w-full"
          />
        </label>
        <label className="block">
          <span className="field-label">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="input-field w-full" />
        </label>
        <label className="block">
          <span className="field-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="input-field w-full"
          />
        </label>
        <label className="block">
          <span className="field-label">Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="input-field w-full"
          />
        </label>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading && <Spinner />}
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm muted">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
