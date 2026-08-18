import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/dashboard/dashboard-shell";
import { MessageSquare } from "lucide-react";

type MessageRow = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  campaign_id: string;
  campaigns: { name: string } | { name: string }[] | null;
};

function campaignName(c: { name: string } | { name: string }[] | null): string {
  if (!c) return "Campaign";
  return Array.isArray(c) ? (c[0]?.name ?? "Campaign") : c.name;
}

export async function CampaignMessages({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, body, sender_id, created_at, campaign_id, campaigns(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (messages ?? []) as MessageRow[];

  // Resolve sender display names from both profile tables.
  const senderIds = [...new Set(rows.map((m) => m.sender_id))];
  const [creators, businesses] = await Promise.all([
    senderIds.length
      ? supabase.from("creator_profiles").select("user_id, display_name").in("user_id", senderIds)
      : { data: [] },
    senderIds.length
      ? supabase.from("business_profiles").select("user_id, company_name").in("user_id", senderIds)
      : { data: [] },
  ]);

  const nameBySender = new Map<string, string>();
  for (const c of (creators.data ?? []) as { user_id: string; display_name: string }[]) {
    nameBySender.set(c.user_id, c.display_name);
  }
  for (const b of (businesses.data ?? []) as { user_id: string; company_name: string }[]) {
    nameBySender.set(b.user_id, b.company_name);
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No messages yet"
        description="Once a creator is accepted onto a campaign, you can chat with them here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((m) => {
        const isMe = m.sender_id === userId;
        return (
          <div key={m.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {isMe ? "You" : nameBySender.get(m.sender_id) ?? "Participant"}
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {campaignName(m.campaigns)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(m.created_at).toLocaleString()}
              </p>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{m.body}</p>
          </div>
        );
      })}
    </div>
  );
}
