import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing required env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const email = process.argv[2];

if (!email) {
  console.error("Usage: npm run seed:admin <email>");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }

  const user = users.users.find((u) => u.email === email);

  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { role: "admin" },
  });

  if (error) {
    console.error("Failed to set admin role:", error.message);
    process.exit(1);
  }

  console.log(`Successfully set admin role for ${email}`);
  console.log("User must enable TOTP MFA before accessing /admin routes.");
}

main();
