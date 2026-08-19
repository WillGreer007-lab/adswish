"use client";

import { useEffect, useState } from "react";
import { UserPlus, Check, Clock, Loader2 } from "lucide-react";

type State = "loading" | "none" | "requested" | "friends" | "self";

export function ConnectButton({ targetUserId }: { targetUserId: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
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
      <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-sm font-medium text-success">
        <Check className="h-4 w-4" /> Friends
      </span>
    );
  }

  if (state === "requested") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
        <Clock className="h-4 w-4" /> Request sent
      </span>
    );
  }

  return (
    <button
      onClick={addFriend}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      Add friend
    </button>
  );
}
