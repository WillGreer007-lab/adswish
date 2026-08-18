"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Send, Loader2 } from "lucide-react";

type ChatMessage = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  campaign_id: string;
};

/**
 * Realtime campaign chat. Subscribes to postgres_changes on `messages`
 * (added to supabase_realtime in migration 020) so new messages from the
 * other party appear instantly. If the WebSocket is unavailable (CSP,
 * offline, mixed content), it falls back to a 5s REST poll — never crashes.
 */
export function CampaignChat({
  campaignId,
  userId,
  initial,
  onSend,
}: {
  campaignId: string;
  userId: string;
  initial: ChatMessage[];
  onSend?: (message: ChatMessage) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeOn, setRealtimeOn] = useState(true);
  const realtimeOnRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateRealtime = (on: boolean) => {
    realtimeOnRef.current = on;
    setRealtimeOn(on);
  };

  const fetchLatest = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("messages")
        .select("id, body, sender_id, created_at, campaign_id")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setMessages(([...data] as ChatMessage[]).reverse());
    } catch {
      /* ignore poll errors */
    }
  }, [campaignId]);

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]> | null = null;
    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const startPolling = () => {
      if (pollRef.current) return;
      updateRealtime(false);
      pollRef.current = setInterval(fetchLatest, 5000);
    };

    let supabase: ReturnType<typeof createSupabaseBrowserClient> | null = null;
    try {
      supabase = createSupabaseBrowserClient();
      channel = supabase
        .channel(`campaign-chat-${campaignId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `campaign_id=eq.${campaignId}`,
          },
          (payload) => {
            const row = payload.new as ChatMessage;
            if (row && row.id) {
              setMessages((prev) =>
                prev.some((m) => m.id === row.id)
                  ? prev
                  : [...prev, row],
              );
              onSend?.(row);
            }
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            updateRealtime(true);
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } else {
            startPolling();
          }
        });
    } catch {
      // Realtime client unavailable — fall back to polling shortly.
      fallbackTimer = setTimeout(() => {
        if (!cancelled) startPolling();
      }, 1500);
    }

    // If the socket never confirms within a few seconds (CSP / offline),
    // flip to polling rather than leaving the chat silent.
    fallbackTimer = setTimeout(() => {
      if (!cancelled && !pollRef.current && !realtimeOnRef.current) {
        startPolling();
      }
    }, 4000);

    return () => {
      cancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (pollRef.current) clearInterval(pollRef.current);
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [campaignId, fetchLatest, onSend]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Failed to send message");
        return;
      }
      const msg = data?.message as ChatMessage | undefined;
      if (msg) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (data.pii_detected) {
          setError("Note: emails/phone numbers/links were redacted for safety.");
        }
      }
      setDraft("");
    } catch {
      setError("Network error — try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={`inline-block h-2 w-2 rounded-full ${realtimeOn ? "bg-success" : "bg-muted"}`}
        />
        {realtimeOn ? "Live — messages appear instantly" : "Offline mode — checking for new messages"}
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No messages yet — say hello to start the conversation.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  mine ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          maxLength={4000}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </button>
      </form>
    </div>
  );
}
