// ============================================================================
// services/supabase/bank.js — banque du joueur (mise à jour 0056).
//
// Toute écriture passe par la fonction Supabase `adjust_player_balance`
// (security definer, transaction atomique, jamais de solde négatif).
// Cette fonction n'est accessible qu'via la clé SERVICE_ROLE_KEY (voir
// SUPABASE_UPDATE_0056_BANQUE_DISCORD.sql) : le jeu ne peut jamais modifier
// un solde lui-même, seulement le lire.
// ============================================================================

const { getSupabase } = require("./client");

async function getBalance(profileId) {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase non configuré" };
  const { data, error } = await supabase
    .from("profiles")
    .select("balance")
    .eq("id", profileId)
    .maybeSingle();
  if (error) {
    console.error("[bank] Erreur getBalance :", error.message);
    return { error: error.message };
  }
  if (!data) return { error: "Joueur introuvable" };
  return { balance: data.balance };
}

/**
 * Ajoute (amount > 0) ou retire (amount < 0) de l'argent au solde d'un
 * joueur, de façon atomique. Rejette (sans rien modifier) si ça ferait
 * passer le solde sous zéro.
 */
async function adjustBalance({ profileId, amount, reason, actorDiscordId }) {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase non configuré" };

  const { data, error } = await supabase.rpc("adjust_player_balance", {
    p_profile_id: profileId,
    p_amount: amount,
    p_reason: reason || null,
    p_actor_discord_id: actorDiscordId,
  });

  if (error) {
    console.error("[bank] Erreur adjustBalance :", error.message);
    return { error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { balance: row ? row.balance : null };
}

module.exports = { getBalance, adjustBalance };
