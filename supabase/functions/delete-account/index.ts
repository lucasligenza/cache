// Deletes the signed-in user's notes, categories, and push subscriptions,
// then the auth user. verify_jwt stays ON (the platform default): only a
// user JWT in Authorization reaches this code. The service role key never
// leaves the function.
//
// Deploy is a manual step for Lucas. This file is not applied to production
// from the repo alone.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleDeleteAccount, jsonResponse, type UserTable } from './deleteAccount.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const userClient = () => createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const adminClient = () => createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('delete-account: missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY');
    return jsonResponse({ error: 'account deletion is not configured' }, 500);
  }

  return handleDeleteAccount(req, {
    async userFromJwt(jwt) {
      // Round-trip to Auth. Do not decode the JWT locally, and do not read
      // a user id from the body.
      const { data, error } = await userClient().auth.getUser(jwt);
      if (error || !data.user?.id) return null;
      return { id: data.user.id };
    },
    store: {
      async deleteOwnedRows(table: UserTable, userId: string) {
        const { error } = await adminClient().from(table).delete().eq('user_id', userId);
        if (error) {
          console.error(`delete-account: ${table}`, error.message);
          return { message: error.message };
        }
        return null;
      },
      async deleteAuthUser(userId: string) {
        const { error } = await adminClient().auth.admin.deleteUser(userId);
        if (error) {
          console.error('delete-account: auth user', error.message);
          return { message: error.message };
        }
        return null;
      },
    },
  });
});
