"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, Check, Clock, Loader2, Copy, CheckCheck, MessageSquare } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type State = "loading" | "none" | "requested" | "friends" | "self";

export function ConnectButton({
  targetUserId,
  targetHandle,
}: {
  targetUserId: string;
  /** Primary social handle, shown as @handle and used by "Copy Username". */
  targetHandle?: string | null;
}) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messagesHref, setMessagesHref] = useState("/dashboard");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Resolve the viewer's role so the Message button lands on the right
      // Messages section (campaign chats live under the role-specific hub).
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role || user?.app_metadata?.role;
      if (!cancelled) {
        setMessagesHref(
          role === "creator"
            ? "/dashboard/creator/messages"
            : role === "business"
              ? "/dashboard/business/messages"
              : "/dashboard",
        );
      }

      fetch("/api/internal/connections")
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (cancelled || !json) return;
          if (json.friends?.some((c: { other: { id: string } }) => c.other?.id === targetUserId)) setState("friends");
          else if (json.outgoing?.some((c: { other: { id: string } }) => c.other?.id === targetUserId)) setState("requested");
          else setState("none");
        })
        .catch(() => {
          if (!cancelled) setState("none");
        });
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  async function addFriend() {
    setBusy(true);
    try {
      const res = await fetch("/api/internal/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressee_id: targetUserId }),
      });
      const json = await res.json();
      if (res.ok) {
        setState(json.exists ? "requested" : "requested");
      } else if (json.error?.toLowerCase().includes("invalid addressee")) {
        setState("self");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyUsername() {
    if (!targetHandle) return;
    try {
      await navigator.clipboard.writeText(`@${targetHandle}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  if (state === "loading") {
    return (
      <button disabled className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  if (state === "self") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
        This is you
      </span>
    );
  }

  if (state === "friends") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-sm font-medium text-success">
          <Check className="h-4 w-4" /> Added
        </span>
        {targetHandle && (
          <button
            onClick={copyUsername}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Username"}
          </button>
        )}
        <Link
          href={messagesHref}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
        >
          <MessageSquare className="h-4 w-4" /> Message
        </Link>
      </div>
    );
  }

  if (state === "requested") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {targetHandle && (
          <span className="text-sm font-medium text-muted-foreground">@{targetHandle}</span>
        )}
        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" /> Request sent
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {targetHandle && (
        <span className="text-sm font-medium text-muted-foreground">@{targetHandle}</span>
      )}
      <button
        onClick={addFriend}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Add friend
      </button>
    </div>
  );
}
