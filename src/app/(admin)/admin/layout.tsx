import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  const role = user.app_metadata?.role;
  if (role !== "admin") {
    redirect("/dashboard");
  }

  // MFA (AAL2) enforcement lives in middleware, which exempts the
  // /admin/mfa-setup enrollment page itself. Checking AAL here caused an
  // infinite redirect loop because this layout wraps mfa-setup too.

  return (
    <div className="min-h-screen bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
