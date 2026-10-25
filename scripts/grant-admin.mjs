import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
try {
  const email = process.argv[process.argv.indexOf("--email") + 1];
  if (
    !process.argv.includes("--email") ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    throw new Error("Email required");
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_CHECKOUT_SECRET_KEY,
    { auth: { persistSession: false } },
  );
  let user;
  for (let page = 1; page <= 100 && !user; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw new Error("User lookup failed");
    user = data.users.find(
      (u) =>
        u.email?.toLowerCase() === email.toLowerCase() && u.email_confirmed_at,
    );
    if (data.users.length < 100) break;
  }
  if (!user) throw new Error("Confirmed account required");
  const { error } = await db
    .from("admin_memberships")
    .upsert(
      { user_id: user.id },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (error) throw new Error("Admin grant failed");
  console.log(
    "Administrative access granted to the existing confirmed account. No passwords changed, no emails sent, no credentials printed.",
  );
} catch {
  console.error(
    "Unable to grant administrative access. Confirm the account exists, is verified, and the migration is applied. No private details printed.",
  );
  process.exitCode = 1;
}
