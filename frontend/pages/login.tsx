import { FormEvent, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { Alert, AuthCard, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/api";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { addToast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(username, password);
      addToast(`Welcome back, ${user.username}.`, "success");
      const next = typeof router.query.next === "string" && router.query.next.startsWith("/") ? router.query.next : "/";
      router.push(next);
    } catch (err) {
      setError(getErrorMessage(err, "Sign-in failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard icon={<LogIn className="w-5 h-5" />} title="Sign in">
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
            className="input-field w-full"
          />
        </label>
        <label className="block">
          <span className="field-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="input-field w-full"
          />
        </label>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading && <Spinner />}
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm muted">
        No account yet?{" "}
        <Link href="/register" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
          Create one
        </Link>
      </p>
    </AuthCard>
  );
}
