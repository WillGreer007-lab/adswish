"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, Check, X, Mail } from "lucide-react";

type Member = {
  business_id: string;
  user_id: string;
  role: string;
  invited_at: string;
  joined_at: string | null;
};

export function TeamManagement({
  initialMembers,
  isOwner,
  pendingInvite,
}: {
  initialMembers: Member[];
  isOwner: boolean;
  pendingInvite: boolean;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function invite() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/internal/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Could not invite.");
      return;
    }
    setMessage(json.message || "Invitation sent.");
    setEmail("");
    router.refresh();
  }

  async function accept() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/internal/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Could not accept.");
      return;
    }
    router.refresh();
  }

  async function decline() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/internal/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Could not decline.");
      return;
    }
    router.refresh();
  }

  async function revoke(userId: string) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/internal/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Could not remove.");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-success">{message}</p>}

      {/* Pending invite the current user must accept/decline. */}
      {pendingInvite && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-primary" />
            You&apos;ve been invited to this business team.
          </div>
          <div className="flex gap-2">
            <button
              onClick={accept}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Accept
            </button>
            <button
              onClick={decline}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Decline
            </button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 space-y-1">
            <label htmlFor="invite-email" className="text-xs font-medium text-muted-foreground">
              Invite by email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="invite-role" className="text-xs font-medium text-muted-foreground">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "admin")}
              className="rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            onClick={invite}
            disabled={loading || !email.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Invite
          </button>
        </div>
      )}

      <div className="space-y-2">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members yet.</p>
        ) : (
          members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-mono text-xs font-medium">{m.user_id}</p>
                <p className="text-xs text-muted-foreground">
                  {m.joined_at
                    ? `Joined ${new Date(m.joined_at).toLocaleDateString()}`
                    : `Invited ${new Date(m.invited_at).toLocaleDateString()} — pending`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs capitalize text-muted-foreground">
                  {m.role}
                </span>
                {isOwner && (
                  <button
                    onClick={() => revoke(m.user_id)}
                    disabled={loading}
                    className="rounded-md border border-destructive/60 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
