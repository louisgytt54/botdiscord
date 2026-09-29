// ============================================================================
// services/supabase/bank.js — banque du joueur, branchée sur le système
// économique DÉJÀ existant du jeu :
//   · public.player_wallets(user_id, credits, updated_at)  — migration 0017
//   · public.player_transactions(...) pour l'historique     — migration 0004
//
// Toute écriture passe par la fonction Supabase `bank_admin_adjust_wallet`
// (security definer, transaction atomique, jamais de solde négatif) — voir
// SUPABASE_UPDATE_BOT_BANQUE_DISCORD.sql. Cette fonction n'est accessible
// qu'via la clé SERVICE_ROLE_KEY : le jeu ne peut jamais l'appeler.
// ============================================================================

const { getSupabase } = require("./client");

async function getBalance(profileId) {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase non configuré" };
  const { data, error } = await supabase
    .from("player_wallets")
    .select("credits")
    .eq("user_id", profileId)
    .maybeSingle();
  if (error) {
    console.error("[bank] Erreur getBalance :", error.message);
    return { error: error.message };
  }
  if (!data) return { error: "Portefeuille introuvable pour ce joueur" };
  return { balance: data.credits };
}

/**
 * Ajoute (amount > 0) ou retire (amount < 0) des crédits du portefeuille
 * d'un joueur, de façon atomique. Rejette (sans rien modifier) si ça ferait
 * passer le solde sous zéro. Journalise l'opération dans
 * player_transactions comme n'importe quelle autre transaction du jeu.
 */
async function adjustBalance({ profileId, amount, reason, actorDiscordId }) {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase non configuré" };

  const { data, error } = await supabase.rpc("bank_admin_adjust_wallet", {
    p_user_id: profileId,
    p_amount: amount,
    p_reason: reason || null,
    p_actor_discord_id: actorDiscordId,
  });

  if (error) {
    console.error("[bank] Erreur adjustBalance :", error.message);
    return { error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { balance: row ? row.credits : null };
}

module.exports = { getBalance, adjustBalance };
