/**
 * Minimal Google Ads API client (v18 REST endpoints). Used by the internal
 * routes to list the business's accessible Ads customers and their campaigns.
 * Kept behind a thin module so the endpoints can be versioned independently.
 */

const ADS_API_BASE = "https://googleads.googleapis.com/v18";

type AccessibleCustomersResponse = {
  resourceNames?: string[]; // "customers/{id}"
};

export type GoogleAdsCampaign = {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  budgetMicros: string;
};

export type GoogleAdsCampaignMetrics = {
  id: string;
  spendCents: number;
  revenueCents: number;
  conversions: number;
};

export function developerToken(): string {
  return process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
}

/**
 * Thrown when a live Ads API call is needed but GOOGLE_ADS_DEVELOPER_TOKEN is
 * missing — callers surface a friendly "not configured" message instead of a
 * raw API error. Defined here (not in campaigns.ts) to avoid an import cycle.
 */
export class GoogleAdsNotConfiguredError extends Error {
  constructor(message = "Google Ads developer token is not configured yet") {
    super(message);
    this.name = "GoogleAdsNotConfiguredError";
  }
}

export function customerIdFromResource(resourceName: string): string {
  return resourceName.replace(/^customers\//, "");
}

/** List the Ads customer IDs the authenticated user can access. */
export async function listAccessibleCustomers(accessToken: string): Promise<string[]> {
  const res = await fetch(`${ADS_API_BASE}/customers:listAccessibleCustomers`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Ads listAccessibleCustomers failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as AccessibleCustomersResponse;
  return (data.resourceNames ?? []).map(customerIdFromResource);
}

/** Search a customer's active/paused campaigns via GAQL. */
export async function listCampaigns(accessToken: string, customerId: string): Promise<GoogleAdsCampaign[]> {
  const res = await fetch(`${ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken(),
      "login-customer-id": customerId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query:
        "SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign ORDER BY campaign.name",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Ads search failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { results?: Array<{ campaign: GoogleAdsCampaign }> };
  return (data.results ?? []).map((r) => r.campaign);
}

/**
 * Create a campaign via MutateCampaigns (v18). Requires the developer token;
 * throws {@link GoogleAdsNotConfiguredError} when it is missing so callers can
 * surface a friendly message instead of a raw API error.
 */
export async function createGoogleAdsCampaign(
  accessToken: string,
  customerId: string,
  input: { name: string; dailyBudgetCents: number; goal: "search" | "social" | "pmax" },
): Promise<string> {
  if (!developerToken()) throw new GoogleAdsNotConfiguredError();

  const budget = Math.round(input.dailyBudgetCents * 10_000); // cents -> micros
  const res = await fetch(`${ADS_API_BASE}/customers/${customerId}/campaigns:mutate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken(),
      "login-customer-id": customerId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operations: [
        {
          create: {
            name: input.name,
            advertising_channel_type: "SEARCH",
            status: "ENABLED",
            start_date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
            end_date: "20371231",
            campaign_budget: {
              amount_micros: budget,
              delivery_method: "STANDARD",
            },
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Ads campaign create failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    results?: Array<{ resource_name?: string }>;
  };
  return data.results?.[0]?.resource_name ?? "";
}

/**
 * Pull last-30-days spend/revenue/conversions per campaign (GAQL reporting).
 * Requires the developer token; throws {@link GoogleAdsNotConfiguredError} when
 * it is missing so the reporting job can skip cleanly.
 */
export async function listCampaignMetrics(
  accessToken: string,
  customerId: string,
): Promise<GoogleAdsCampaignMetrics[]> {
  if (!developerToken()) throw new GoogleAdsNotConfiguredError();

  const res = await fetch(`${ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken(),
      "login-customer-id": customerId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query:
        "SELECT campaign.id, metrics.cost_micros, metrics.conversions_value, metrics.conversions FROM campaign WHERE campaign.status != 'REMOVED' AND segments.date DURING LAST_30_DAYS",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Ads metrics failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      campaign: { id: string };
      metrics?: { cost_micros?: string; conversions_value?: number; conversions?: number };
    }>;
  };
  return (data.results ?? []).map((r) => ({
    id: r.campaign.id,
    spendCents: Math.round((Number(r.metrics?.cost_micros ?? 0) / 10_000)),
    revenueCents: Math.round((Number(r.metrics?.conversions_value ?? 0) / 10_000)),
    conversions: Math.round(Number(r.metrics?.conversions ?? 0)),
  }));
}

/** Pause or enable a campaign (MutateCampaigns). Requires the developer token. */
export async function updateGoogleAdsCampaignStatus(
  accessToken: string,
  customerId: string,
  googleCampaignId: string,
  status: "ENABLED" | "PAUSED",
): Promise<void> {
  if (!developerToken()) throw new GoogleAdsNotConfiguredError();

  const res = await fetch(`${ADS_API_BASE}/customers/${customerId}/campaigns:mutate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken(),
      "login-customer-id": customerId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operations: [
        {
          update: {
            resource_name: `customers/${customerId}/campaigns/${googleCampaignId}`,
            status,
          },
          update_mask: { paths: ["status"] },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Ads campaign update failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
