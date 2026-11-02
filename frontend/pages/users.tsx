import { FormEvent, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  type LucideIcon,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { Alert, AuthGate, ConfirmDialog, Modal, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useAsync } from "../hooks/useAsync";
import {
  createUser,
  deleteUser,
  fetchAuthConfig,
  fetchUsers,
  getErrorMessage,
  resetUserPassword,
  updateUser,
} from "../utils/api";
import { formatWhen } from "../utils/format";
import { passwordProblem } from "../utils/passwords";
import type { ManagedUser, NewUserResult } from "../types";

type ConfirmedAction = "promote" | "demote" | "disable" | "reset" | "delete";
type Action = ConfirmedAction | "enable";

const CONFIRM: Record<ConfirmedAction, { title: (name: string) => string; message: string; label: string; danger: boolean }> = {
  promote: {
    title: (name) => `Make ${name} an admin?`,
    message: "They'll be able to delete records, upload and import data, and manage users, including you.",
    label: "Make admin",
    danger: false,
  },
  demote: {
    title: (name) => `Remove admin access from ${name}?`,
    message: "They keep their account and can still add and edit records and score games.",
    label: "Remove admin",
    danger: true,
  },
  disable: {
    title: (name) => `Disable ${name}'s account?`,
    message:
      "They'll be signed out everywhere and can't sign in until you enable the account again. Their records stay.",
    label: "Disable account",
    danger: true,
  },
  reset: {
    title: (name) => `Reset ${name}'s password?`,
    message:
      "They'll be signed out everywhere. You'll get a temporary password to give them, which they can change on their Account page.",
    label: "Reset password",
    danger: true,
  },
  delete: {
    title: (name) => `Delete ${name}?`,
    message: "This removes the account for good. Records and games they entered stay.",
    label: "Delete user",
    danger: true,
  },
};

interface Secret {
  username: string;
  password: string;
  created: boolean;
}

export default function UsersPage() {
  return (
    <>
      <PageHeader title="Users" subtitle="Add people, choose who's an admin, and turn off access." />
      <AuthGate admin action="manage users">
        <UserManager />
      </AuthGate>
    </>
  );
}

function UserManager() {
  const { user: me } = useAuth();
  const { addToast } = useToast();
  const users = useAsync(() => fetchUsers(), []);
  const config = useAsync(() => fetchAuthConfig(), []);
  const [pending, setPending] = useState<{ action: ConfirmedAction; user: ManagedUser } | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);

  const perform = async (action: Action, u: ManagedUser) => {
    setBusy(true);
    try {
      let message: string | null = null;
      if (action === "promote") {
        await updateUser(u.id, { is_admin: true });
        message = `${u.username} is now an admin.`;
      } else if (action === "demote") {
        await updateUser(u.id, { is_admin: false });
        message = `${u.username} is no longer an admin.`;
      } else if (action === "disable") {
        await updateUser(u.id, { is_active: false });
        message = `${u.username}'s account is disabled.`;
      } else if (action === "enable") {
        await updateUser(u.id, { is_active: true });
        message = `${u.username} can sign in again.`;
      } else if (action === "reset") {
        const { temporary_password } = await resetUserPassword(u.id);
        setSecret({ username: u.username, password: temporary_password, created: false });
      } else {
        await deleteUser(u.id);
        message = `Deleted ${u.username}.`;
      }
      if (message) addToast(message, "success");
      setPending(null);
      users.reload();
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const onCreated = (result: NewUserResult) => {
    setAdding(false);
    users.reload();
    addToast(`Added ${result.user.username}.`, "success");
    if (result.temporary_password) {
      setSecret({ username: result.user.username, password: result.temporary_password, created: true });
    }
  };

  const list = users.data ?? [];
  const confirm = pending ? CONFIRM[pending.action] : null;

  return (
    <>
      <div className="flex justify-end mb-4">
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
          <UserPlus className="w-4 h-4" /> Add user
        </button>
      </div>

      {users.loading && !users.data ? (
        <LoadingSpinner label="Loading users..." />
      ) : users.error && !users.data ? (
        <ErrorMessage message={users.error} onRetry={users.reload} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Last sign-in</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isMe={u.id === me?.id}
                    onAction={(action) => (action === "enable" ? perform("enable", u) : setPending({ action, user: u }))}
                    disabled={busy}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {config.data && (
        <p className="text-xs muted mt-4">
          {config.data.registration_open ? (
            <>
              Anyone can create an account right now. To close sign-ups, set{" "}
              <code className="font-mono">ALLOW_REGISTRATION=false</code> on the server and restart it.
            </>
          ) : (
            "Public sign-up is closed, so new people need an account from you. Use Add user."
          )}
        </p>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending && confirm ? confirm.title(pending.user.username) : ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.label ?? ""}
        danger={confirm?.danger ?? true}
        busy={busy}
        onConfirm={() => pending && perform(pending.action, pending.user)}
        onCancel={() => setPending(null)}
      />

      <Modal open={adding} title="Add user" onClose={() => setAdding(false)}>
        <AddUserForm onCreated={onCreated} onCancel={() => setAdding(false)} />
      </Modal>

      <TemporaryPasswordDialog secret={secret} onClose={() => setSecret(null)} />
    </>
  );
}

function UserRow({
  user: u,
  isMe,
  onAction,
  disabled,
}: {
  user: ManagedUser;
  isMe: boolean;
  onAction: (action: Action) => void;
  disabled: boolean;
}) {
  return (
    <tr className={u.is_active ? "" : "opacity-70"}>
      <td>
        <div className="font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
          {u.username}
          {isMe && <span className="badge-blue">You</span>}
        </div>
        <div className="text-xs muted">{u.email}</div>
      </td>
      <td>
        {u.is_admin ? (
          <span className="badge-purple gap-1">
            <ShieldCheck className="w-3 h-3" /> Admin
          </span>
        ) : (
          <span className="badge-gray">User</span>
        )}
      </td>
      <td>{u.is_active ? <span className="badge-green">Active</span> : <span className="badge-red">Disabled</span>}</td>
      <td className="whitespace-nowrap">{formatWhen(u.created_at)}</td>
      <td className="whitespace-nowrap">{u.last_login_at ? formatWhen(u.last_login_at) : "Never"}</td>
      <td>
        {isMe ? (
          <p className="text-xs muted text-right whitespace-nowrap">Change your password on the Account page</p>
        ) : (
          <div className="flex flex-wrap justify-end gap-1">
            {u.is_admin ? (
              <ActionButton icon={ShieldOff} label="Remove admin" onClick={() => onAction("demote")} disabled={disabled} />
            ) : (
              <ActionButton icon={ShieldCheck} label="Make admin" onClick={() => onAction("promote")} disabled={disabled} />
            )}
            {u.is_active ? (
              <ActionButton icon={UserX} label="Disable" onClick={() => onAction("disable")} disabled={disabled} />
            ) : (
              <ActionButton icon={UserCheck} label="Enable" onClick={() => onAction("enable")} disabled={disabled} />
            )}
            <ActionButton icon={KeyRound} label="Reset password" onClick={() => onAction("reset")} disabled={disabled} />
            <ActionButton icon={Trash2} label="Delete" onClick={() => onAction("delete")} disabled={disabled} danger />
          </div>
        )}
      </td>
    </tr>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn-ghost text-xs gap-1.5 whitespace-nowrap ${
        danger ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30" : ""
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function AddUserForm({ onCreated, onCancel }: { onCreated: (r: NewUserResult) => void; onCancel: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = password ? passwordProblem(password, password) : null;
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onCreated(await createUser({ username, email, password: password || undefined, is_admin: isAdmin }));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't add the user."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert kind="error">{error}</Alert>}
      <label className="block">
        <span className="field-label">Username</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          autoComplete="off"
          pattern="[A-Za-z0-9_.\-]{3,32}"
          title="3-32 letters, numbers, dots, dashes or underscores"
          className="input-field w-full"
        />
      </label>
      <label className="block">
        <span className="field-label">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="off"
          className="input-field w-full"
        />
      </label>
      <label className="block">
        <span className="field-label">Password (optional)</span>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          spellCheck={false}
          placeholder="Leave blank to generate one"
          className="input-field w-full font-mono"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="rounded" />
        Make this user an admin
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy && <Spinner />}
          {busy ? "Adding..." : "Add user"}
        </button>
      </div>
    </form>
  );
}

function TemporaryPasswordDialog({ secret, onClose }: { secret: Secret | null; onClose: () => void }) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  const close = () => {
    setCopied(false);
    onClose();
  };

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.password);
      setCopied(true);
    } catch {
      addToast("Couldn't copy automatically. Select the password and copy it.", "error");
    }
  };

  return (
    <Modal
      open={secret !== null}
      title={secret?.created ? `Account created for ${secret.username}` : `New password for ${secret?.username ?? ""}`}
      onClose={close}
    >
      {secret && (
        <>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Give {secret.username} this temporary password privately. It won&apos;t be shown again. They can change it
            on their Account page after signing in.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <code
              className="flex-1 font-mono text-base bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg px-3 py-2 select-all break-all"
              data-testid="temporary-password"
            >
              {secret.password}
            </code>
            <button type="button" className="btn-secondary" onClick={copy}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex justify-end mt-6">
            <button type="button" className="btn-primary" onClick={close}>
              Done
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
