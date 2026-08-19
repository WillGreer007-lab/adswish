import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/dashboard/dashboard-shell";
import { CampaignChat } from "@/components/dashboard/campaign-chat";
import { MessageSquare } from "lucide-react";

type CampaignRow = { id: string; title: string };

/**
 * Messages page body. Loads every campaign the user participates in with its
 * last 50 messages (server-side), then renders a per-campaign chat panel that
 * is live via Supabase Realtime with a polling fallback.
 */
export async function CampaignMessages({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient();

  // Campaigns the user participates in: owned (business) or accepted (creator).
  const [{ data: owned }, { data: accepted }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, title, status")
      .eq("business_id", userId)
      .in("status", ["active", "paused", "paused_budget", "completed"]),
    supabase
      .from("applications")
      .select("campaign_id, campaigns(id, title, status)")
      .eq("creator_id", userId)
      .eq("status", "accepted"),
  ]);

  const ownedRows = (owned ?? []) as CampaignRow[];
  const acceptedRows = ((accepted ?? []) as {
    campaign_id: string;
    campaigns: CampaignRow | CampaignRow[] | null;
  }[]).map((a) => {
    const row = Array.isArray(a.campaigns) ? a.campaigns[0] : a.campaigns;
    return row ? { id: row.id, title: row.title } : null;
  }).filter((x): x is CampaignRow => !!x);

  const byId = new Map<string, string>();
  for (const c of [...ownedRows, ...acceptedRows]) {
    if (!byId.has(c.id)) byId.set(c.id, c.title);
  }

  const campaigns = Array.from(byId, ([id, title]) => ({ id, title }));

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No conversations yet"
        description="Once a creator is accepted onto a campaign, you can chat with them here."
      />
    );
  }

  // Last 50 messages per campaign.
  const { data: allMessages } = await supabase
    .from("messages")
    .select("id, body, sender_id, created_at, campaign_id")
    .in(
      "campaign_id",
      campaigns.map((c) => c.id),
    )
    .order("created_at", { ascending: true })
    .limit(50 * campaigns.length);

  const byCampaign = new Map<string, NonNullable<typeof allMessages>>();
  for (const m of allMessages ?? []) {
    const list = byCampaign.get(m.campaign_id) ?? [];
    list.push(m);
    byCampaign.set(m.campaign_id, list);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      {/* Campaign list */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Conversations
        </p>
        {campaigns.map((c) => (
          <a
            key={c.id}
            href={`#chat-${c.id}`}
            className="block truncate rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-primary/50"
          >
            {c.title}
          </a>
        ))}
      </div>

      {/* Chat panels */}
      <div className="space-y-6">
        {campaigns.map((c) => (
          <section
            key={c.id}
            id={`chat-${c.id}`}
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h2 className="mb-3 font-heading text-base font-semibold">{c.title}</h2>
            <CampaignChat
              campaignId={c.id}
              userId={userId}
              initial={(byCampaign.get(c.id) ?? []) as never}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
