import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPhone = process.env.ADMIN_PHONE_E164?.trim() || null;
const explicitUserId = process.env.ADMIN_USER_ID?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

if (!adminEmail) {
  throw new Error('Missing ADMIN_EMAIL.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const findUserIdByEmail = async () => {
  if (explicitUserId) return explicitUserId;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    const user = data.users.find((item) => item.email?.toLowerCase() === adminEmail);
    if (user) return user.id;
    if (data.users.length < 1000) break;
  }

  throw new Error(`No Supabase auth user found for ${adminEmail}. Log in once first.`);
};

const main = async () => {
  const userId = await findUserIdByEmail();

  const { error } = await supabase.from('admin_users').upsert(
    {
      user_id: userId,
      email: adminEmail,
      phone_e164: adminPhone,
      active: true,
    },
    { onConflict: 'email' }
  );

  if (error) throw error;
  console.log(`Admin allowlist updated for ${adminEmail} (${userId}).`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
