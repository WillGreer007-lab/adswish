import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { reviewee_id, campaign_id, rating_out_of_5, written_feedback } = body;

  if (!reviewee_id || !campaign_id || !rating_out_of_5) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (rating_out_of_5 < 1 || rating_out_of_5 > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  if (reviewee_id === user.id) {
    return NextResponse.json({ error: "Cannot review yourself" }, { status: 422 });
  }

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("reviewer_id", user.id)
    .eq("reviewee_id", reviewee_id)
    .eq("campaign_id", campaign_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Review already exists for this campaign" }, { status: 409 });
  }

  const { data: review, error } = await supabase
    .from("reviews")
    .insert({
      reviewer_id: user.id,
      reviewee_id,
      campaign_id,
      rating_out_of_5,
      written_feedback: written_feedback || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ review });
}
