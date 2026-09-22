// ============================================================================
// services/supabase/profiles.js — lien Discord <-> profil jeu (Supabase Auth).
//
// Un joueur doit s'être connecté au jeu via Discord AU MOINS UNE FOIS (le
// trigger handle_new_user crée alors sa ligne `profiles`) avant de pouvoir
// candidater depuis le bot : c'est ce qui permet de relier son ID Discord à
// son compte jeu. Sans ça, on ne peut pas savoir à qui donner l'affectation.
// ============================================================================

const { getSupabase } = require("./client");

/** @returns {Promise<{id:string, discord_id:string, username:string}|null>} */
async function getProfileByDiscordId(discordId) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, discord_id, username, avatar_url")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (error) {
    console.error("[profiles] Erreur lookup profil :", error.message);
    return null;
  }
  return data;
}

/**
 * Sens inverse de getProfileByDiscordId : retrouve l'ID Discord d'un joueur
 * à partir de son ID de profil (auth.users.id). Utilisé par le pont
 * tickets support (services/supabase/support.js) pour savoir à qui donner
 * accès au salon Discord d'un ticket ouvert depuis le jeu.
 * @returns {Promise<string|null>}
 */
async function getDiscordIdByProfileId(profileId) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("discord_id")
    .eq("id", profileId)
    .maybeSingle();
  if (error) {
    console.error("[profiles] Erreur lookup discord_id :", error.message);
    return null;
  }
  return data ? data.discord_id : null;
}

/**
 * Résumé minimal d'un profil (nom + avatar + ID Discord) à partir de son ID
 * de profil (auth.users.id). Utilisé par le pont support (support.js) pour
 * afficher l'identité du joueur dans le webhook du salon de ticket.
 * @returns {Promise<{discord_id:string, username:string, avatar_url:string}|null>}
 */
async function getProfileSummaryById(profileId) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("discord_id, username, avatar_url")
    .eq("id", profileId)
    .maybeSingle();
  if (error) {
    console.error("[profiles] Erreur lookup résumé profil :", error.message);
    return null;
  }
  return data;
}

module.exports = { getProfileByDiscordId, getDiscordIdByProfileId, getProfileSummaryById };
