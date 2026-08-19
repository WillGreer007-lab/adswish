import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: invoice } = await supabase
    .from("payout_invoices")
    .select("id, creator_id, pdf_url")
    .eq("id", id)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (!invoice?.pdf_url) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const marker = "/payout-invoices/";
  const path = invoice.pdf_url.includes(marker)
    ? invoice.pdf_url.split(marker)[1]
    : invoice.pdf_url;
  if (!path || path.includes("..")) {
    return NextResponse.json({ error: "Invoice file unavailable" }, { status: 404 });
  }

  const service = createSupabaseServiceRoleClient();
  const { data: signed, error } = await service.storage
    .from("payout-invoices")
    .createSignedUrl(path, 60);
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not create invoice download" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
