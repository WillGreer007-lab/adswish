import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { creator_response } = await request.json();

  if (!creator_response || creator_response.length > 1000) {
    return NextResponse.json({ error: "Response must be 1-1000 characters" }, { status: 400 });
  }

  const { data: review } = await supabase
    .from("reviews")
    .select("reviewee_id, created_at")
    .eq("id", id)
    .single();

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (review.reviewee_id !== user.id) {
    return NextResponse.json({ error: "Only the reviewee can reply" }, { status: 403 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (new Date(review.created_at) < thirtyDaysAgo) {
    return NextResponse.json(
      { error: "Review is locked. Right to reply expires after 30 days." },
      { status: 422 },
    );
  }

  const { error } = await supabase
    .from("reviews")
    .update({ creator_response })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
