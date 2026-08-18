import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from("reviews")
    .update({ reported_by: user.id })
    .eq("id", id)
    .is("reported_by", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const serviceClient = createSupabaseServiceRoleClient();
  await serviceClient.from("notifications").insert({
    user_id: user.id,
    type: "system",
    body: `Review ${id} has been flagged for admin review.`,
    link: `/admin/reviews`,
  });

  return NextResponse.json({ success: true });
}
