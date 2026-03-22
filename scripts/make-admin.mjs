import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://zfpqdsdawjjwsxtfbgjf.supabase.co";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const userId = "01dd7d1a-7c75-4d04-af9b-d155e271bfdd";

if (!supabaseSecretKey) {
  console.error("ERROR: Missing SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { is_admin: true }
});

if (error) {
  console.error("ERROR:", error);
  process.exit(1);
}

console.log("SUCCESS:", data.user?.id);
console.log("APP_METADATA:", data.user?.app_metadata);
