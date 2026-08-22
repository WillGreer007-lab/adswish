"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationCenter({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mutedTypes, setMutedTypes] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    async function fetchNotifications() {
      const supabase = createSupabaseBrowserClient();
      const [{ data }, { data: prefs }] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("notification_preferences")
          .select("muted_types")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      const muted = (prefs?.muted_types as string[] | null) ?? [];
      setMutedTypes(muted);
      const visible = (data || []).filter((n) => !muted.includes(n.type));
      setNotifications(visible);
      setUnreadCount(visible.filter((n) => !n.read).length);
    }
    fetchNotifications();

    // Realtime is a best-effort enhancement. If the WebSocket is unavailable
    // (CSP, offline, mixed content), fall back to the REST fetch above and
    // never let a subscription failure crash the page.
    let channel: ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]> | null = null;
    try {
      const supabase = createSupabaseBrowserClient();
      channel = supabase
        .channel("notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => fetchNotifications(),
        )
        .subscribe();
    } catch (err) {
      // Realtime unavailable — notifications still load on mount via REST.
      console.warn("Notification realtime unavailable:", err);
    }

    return () => {
      if (channel) createSupabaseBrowserClient().removeChannel(channel);
    };
  }, [userId]);

  async function markAllRead() {
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    const supabase = createSupabaseBrowserClient();
    await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", userId);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  const typeColors: Record<string, string> = {
    payment: "text-success",
    application: "text-primary",
    sla: "text-destructive",
    pixel_offline: "text-warning",
    review: "text-primary",
    message: "text-primary",
    system: "text-muted-foreground",
    uptime_outage: "text-destructive",
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-2 hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-heading text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {mutedTypes.length ? "Nothing to show — check your muted types" : "No notifications yet"}
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-2 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50",
                    !n.read && "bg-primary/5",
                  )}
                >
                  <a href={n.link || "#"} className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", typeColors[n.type] || "bg-muted")} style={{ backgroundColor: "currentColor" }} />
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{n.type.replace("_", " ")}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground">{n.body}</p>
                  </a>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                      aria-label="Mark as read"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border px-4 py-2">
            <a
              href="/dashboard/settings/notifications"
              className="text-xs font-medium text-primary hover:underline"
            >
              Notification settings
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
