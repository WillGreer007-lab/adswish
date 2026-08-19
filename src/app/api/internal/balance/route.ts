import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import {
  debitBalance,
  creditBalance,
  cashoutSplit,
  MIN_CASHOUT_CENTS,
} from "@/lib/balance";
import { getStripeClient, getStripeCurrency } from "@/lib/stripe/client";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("balance_cents")
    .eq("user_id", user.id)
    .single();

  const { data: transactions } = await supabase
    .from("balance_transactions")
    .select("id, type, amount_cents, balance_after_cents, description, created_at")
    .eq("business_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: cashouts } = await supabase
    .from("cashout_requests")
    .select("id, amount_cents, fee_cents, net_cents, status, created_at")
    .eq("business_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    balance_cents: Number(profile?.balance_cents ?? 0),
    min_cashout_cents: MIN_CASHOUT_CENTS,
    transactions: transactions ?? [],
    cashouts: cashouts ?? [],
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.user_metadata?.role !== "business") {
    return NextResponse.json({ error: "Business account required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const amountCents = Number(body?.amount_cents);
  if (!Number.isFinite(amountCents) || amountCents < MIN_CASHOUT_CENTS) {
    return NextResponse.json(
      { error: `Minimum cash-out is ${(MIN_CASHOUT_CENTS / 100).toFixed(2)}` },
      { status: 400 },
    );
  }

  const service = createSupabaseServiceRoleClient();
  const debit = await debitBalance(
    service,
    user.id,
    amountCents,
    "cashout",
    "Cash-out request",
  );

  if (!debit.ok) {
    return NextResponse.json(
      { error: debit.reason === "insufficient" ? "Insufficient balance" : "Profile not found" },
      { status: 422 },
    );
  }

  const { feeCents, netCents } = cashoutSplit(amountCents);

  const { data: profile } = await service
    .from("business_profiles")
    .select("stripe_account_id, stripe_connect_ready")
    .eq("user_id", user.id)
    .single();

  let status = "requested";
  let note = "Cash-out requested. Payout will be sent once your payout account is verified.";

  if (profile?.stripe_account_id && profile.stripe_connect_ready) {
    try {
      const stripe = getStripeClient();
      await stripe.transfers.create({
        amount: netCents,
        currency: getStripeCurrency(),
        destination: profile.stripe_account_id,
        transfer_group: `cashout-${user.id}`,
        description: "Adswish business cash-out",
      });
      status = "paid";
      note = `Cash-out sent: ${(netCents / 100).toFixed(2)} (after ${(feeCents / 100).toFixed(2)} fee).`;
    } catch (e) {
      // Refund the balance and record the failure so the business isn't stuck.
      await creditBalance(
        service,
        user.id,
        amountCents,
        "adjustment",
        "Cash-out transfer failed — balance returned",
      );
      status = "failed";
      note = e instanceof Error ? `Payout failed and balance returned: ${e.message}` : "Payout failed and balance returned.";
    }
  }

  await service.from("cashout_requests").insert({
    business_id: user.id,
    amount_cents: amountCents,
    fee_cents: feeCents,
    net_cents: netCents,
    status,
  });

  return NextResponse.json({
    ok: status !== "failed",
    balance_after_cents: status === "failed" ? amountCents + debit.balanceAfter : debit.balanceAfter,
    amount_cents: amountCents,
    fee_cents: feeCents,
    net_cents: netCents,
    status,
    note,
  });
}
