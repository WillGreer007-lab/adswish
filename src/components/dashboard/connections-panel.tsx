"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search, UserPlus, Check, X, Loader2, Megaphone } from "lucide-react";

type Other = { id: string; name: string; role: "creator" | "business"; avatar: string | null };
type Conn = { id: string; status: string; other: Other };
type SearchResult = { id: string; name: string; role: string; avatar: string | null; meta?: string };
type Campaign = { id: string; title: string };

function Avatar({ p }: { p: Other | SearchResult }) {
  if (p.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.avatar} alt={p.name} className="h-9 w-9 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {p.name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}

export function ConnectionsPanel({ userId, role }: { userId: string; role: "creator" | "business" }) {
  const [friends, setFriends] = useState<Conn[]>([]);
  const [incoming, setIncoming] = useState<Conn[]>([]);
  const [outgoing, setOutgoing] = useState<Conn[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [invitingFor, setInvitingFor] = useState<string | null>(null);
  const [inviteCampaign, setInviteCampaign] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/internal/connections");
    if (res.ok) {
      const json = await res.json();
      const byName = (a: Conn, b: Conn) => a.other.name.localeCompare(b.other.name);
      setFriends([...(json.friends ?? [])].sort(byName));
      setIncoming(json.incoming ?? []);
      setOutgoing(json.outgoing ?? []);
    }
    if (role === "business") {
      const c = await fetch("/api/internal/campaigns?role=business").then((r) => r.json());
      setCampaigns((c.campaigns ?? []).map((x: { id: string; title: string }) => ({ id: x.id, title: x.title })));
    }
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/connections")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const byName = (a: Conn, b: Conn) => a.other.name.localeCompare(b.other.name);
        setFriends([...(json.friends ?? [])].sort(byName));
        setIncoming(json.incoming ?? []);
        setOutgoing(json.outgoing ?? []);
      })
      .catch(() => {});
    if (role === "business") {
      fetch("/api/internal/campaigns?role=business")
        .then((r) => r.json())
        .then((c) => {
          if (!cancelled) setCampaigns((c.campaigns ?? []).map((x: { id: string; title: string }) => ({ id: x.id, title: x.title })));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [role]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearchChange(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      fetch(`/api/internal/users/search?q=${encodeURIComponent(value)}`)
        .then((r) => r.json())
        .then((json) => setResults(json.results ?? []))
        .finally(() => setSearching(false));
    }, 250);
  }

  async function respond(connectionId: string, action: "accept" | "reject") {
    await fetch("/api/internal/connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connection_id: connectionId, action }),
    });
    load();
  }

  async function sendInvite(creatorId: string) {
    if (!inviteCampaign) return;
    await fetch("/api/internal/campaign-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: inviteCampaign, creator_id: creatorId }),
    });
    setInvitingFor(null);
    setInviteCampaign("");
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="font-heading text-sm font-semibold">Connections</h2>
          <p className="text-xs text-muted-foreground">Friends, requests, and campaign invites.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowSearch((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {showSearch && (
        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search usernames…"
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              autoFocus
            />
          </div>
          <div className="mt-3 space-y-2">
            {searching && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Searching…</p>}
            {results.map((r) => (
              <div key={`${r.role}-${r.id}`} className="flex items-center gap-3">
                <Avatar p={r} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.role === "creator" ? "Creator" : "Business"}{r.meta ? ` · ${r.meta}` : ""}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    fetch("/api/internal/connections", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ addressee_id: r.id }),
                    }).then(() => load());
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:border-primary/50"
                >
                  <UserPlus className="h-3 w-3" /> Add
                </button>
              </div>
            ))}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-muted-foreground">No users found.</p>
            )}
          </div>
        </div>
      )}

      <div className="divide-y divide-border">
        {incoming.length > 0 && (
          <div className="p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Friend requests</h3>
            <div className="space-y-2">
              {incoming.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <Avatar p={c.other} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.other.name}</p>
                    <p className="text-xs text-muted-foreground">{c.other.role === "creator" ? "Creator" : "Business"}</p>
                  </div>
                  <button onClick={() => respond(c.id, "accept")} className="inline-flex items-center gap-1 rounded-md bg-success px-2.5 py-1 text-xs font-medium text-white">
                    <Check className="h-3 w-3" /> Accept
                  </button>
                  <button onClick={() => respond(c.id, "reject")} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium">
                    <X className="h-3 w-3" /> Decline
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Friends ({friends.length})</h3>
          {friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No friends yet. Use <span className="font-medium">Add</span> to search and connect.
            </p>
          ) : (
            <div className="space-y-2">
              {friends.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <Avatar p={c.other} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.other.name}</p>
                    <p className="text-xs text-muted-foreground">{c.other.role === "creator" ? "Creator" : "Business"}</p>
                  </div>
                  {role === "business" && c.other.role === "creator" && (
                    invitingFor === c.other.id ? (
                      <div className="flex items-center gap-1.5">
                        <select value={inviteCampaign} onChange={(e) => setInviteCampaign(e.target.value)} className="max-w-40 rounded-md border border-border bg-background px-2 py-1 text-xs">
                          <option value="">Choose campaign…</option>
                          {campaigns.map((camp) => (
                            <option key={camp.id} value={camp.id}>{camp.title}</option>
                          ))}
                        </select>
                        <button onClick={() => sendInvite(c.other.id)} disabled={!inviteCampaign} className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">
                          Send
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setInvitingFor(c.other.id); setInviteCampaign(""); }} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:border-primary/50">
                        <Megaphone className="h-3 w-3" /> Invite
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
