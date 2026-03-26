import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://zfpqdsdawjjwsxtfbgjf.supabase.co";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  const value = process.argv[index + 1];
  return typeof value === "string" ? value.trim() : "";
}

const targetUserId = getArgValue("--user-id") || process.env.SUPABASE_TARGET_USER_ID || "";
const targetEmail = (getArgValue("--email") || process.env.SUPABASE_TARGET_EMAIL || "").trim().toLowerCase();

if (!supabaseSecretKey) {
  console.error("ERROR: Missing SUPABASE_SECRET_KEY");
  process.exit(1);
}

if (!targetUserId && !targetEmail) {
  console.error("ERROR: Provide --user-id <uuid> or --email <address>");
  console.error("Example: node scripts/make-admin.mjs --email user@example.com");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function resolveUserId() {
  if (targetUserId) return targetUserId;

  let page = 1;
  const perPage = 200;
  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("ERROR: Could not list users:", error.message || error);
      process.exit(1);
    }

    const users = data?.users || [];
    const match = users.find((user) => String(user.email || "").trim().toLowerCase() === targetEmail);
    if (match?.id) return match.id;

    if (users.length < perPage) break;
    page += 1;
  }

  return "";
}

const userId = await resolveUserId();

if (!userId) {
  console.error(`ERROR: Could not find user for ${targetEmail || targetUserId}`);
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { is_admin: true }
});

if (error) {
  console.error("ERROR:", error);
  process.exit(1);
}

console.log("SUCCESS:", data.user?.id);
console.log("EMAIL:", data.user?.email || "");
console.log("APP_METADATA:", data.user?.app_metadata);
