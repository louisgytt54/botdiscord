// ============================================================================
// services/supabase/client.js — client Supabase côté bot (service_role).
//
// ⚠️ Ce client contourne la RLS : il ne doit JAMAIS être exposé ailleurs
// que dans ce processus bot, et la clé ne doit vivre que dans .env
// (SUPABASE_SERVICE_ROLE_KEY), jamais commitée ni envoyée au jeu.
// ============================================================================

const { createClient } = require("@supabase/supabase-js");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

let client = null;

function getSupabase() {
  if (client) return client;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "⚠️ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant : le système de candidatures/affectations ne fonctionnera pas tant que ces variables ne sont pas configurées dans .env."
    );
    return null;
  }

  client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

module.exports = { getSupabase };
