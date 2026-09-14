// ============================================================================
// services/discordRoles.js — synchronise les rôles Discord avec une
// affectation. Ces rôles sont purement représentatifs (voir section 11) :
// ils ne donnent aucun accès au jeu, seule la ligne Supabase compte.
// ============================================================================

const { findRole } = require("../utils/resolve");

async function fetchMember(guild, discordUserId) {
  return guild.members.fetch(discordUserId).catch(() => null);
}

/** Ajoute le rôle général du service + le rôle spécifique du centre (si configuré). */
async function grantRoles(guild, discordUserId, serviceDef, centerRow) {
  const member = await fetchMember(guild, discordUserId);
  if (!member) return;

  const generalRole = serviceDef && findRole(guild, serviceDef.discordRole);
  if (generalRole) await member.roles.add(generalRole).catch(() => {});

  if (centerRow && centerRow.discord_role_id) {
    const centerRole = guild.roles.cache.get(centerRow.discord_role_id);
    if (centerRole) await member.roles.add(centerRole).catch(() => {});
  }
}

/**
 * Retire le rôle du centre, et le rôle général du service UNIQUEMENT si
 * `removeGeneralRole` est vrai (c'est à l'appelant de vérifier qu'il ne
 * reste plus d'autre affectation active sur ce service avant de le retirer,
 * pour ne pas casser le multi-centre — section 14/15).
 */
async function revokeRoles(guild, discordUserId, serviceDef, centerRow, removeGeneralRole) {
  const member = await fetchMember(guild, discordUserId);
  if (!member) return;

  if (centerRow && centerRow.discord_role_id) {
    const centerRole = guild.roles.cache.get(centerRow.discord_role_id);
    if (centerRole) await member.roles.remove(centerRole).catch(() => {});
  }

  if (removeGeneralRole) {
    const generalRole = serviceDef && findRole(guild, serviceDef.discordRole);
    if (generalRole) await member.roles.remove(generalRole).catch(() => {});
  }
}

module.exports = { grantRoles, revokeRoles };
