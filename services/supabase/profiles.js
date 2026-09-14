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

module.exports = { getProfileByDiscordId };
