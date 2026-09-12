// ============================================================================
// utils/resolve.js — petites fonctions pour retrouver un rôle ou un salon
// que ce soit par son ID ou par son nom (pratique pendant la configuration).
// ============================================================================

/**
 * Retrouve un rôle du serveur à partir d'un nom OU d'un ID.
 * @param {import('discord.js').Guild} guild
 * @param {string} nameOrId
 * @returns {import('discord.js').Role|null}
 */
function findRole(guild, nameOrId) {
  if (!nameOrId) return null;
  return (
    guild.roles.cache.get(nameOrId) ||
    guild.roles.cache.find(
      (r) => r.name.toLowerCase() === String(nameOrId).toLowerCase()
    ) ||
    null
  );
}

/**
 * Retrouve un salon du serveur à partir d'un nom OU d'un ID.
 * @param {import('discord.js').Guild} guild
 * @param {string} nameOrId
 * @returns {import('discord.js').GuildBasedChannel|null}
 */
function findChannel(guild, nameOrId) {
  if (!nameOrId) return null;
  return (
    guild.channels.cache.get(nameOrId) ||
    guild.channels.cache.find(
      (c) => c.name.toLowerCase() === String(nameOrId).toLowerCase()
    ) ||
    null
  );
}

/**
 * Vérifie qu'un membre a le rôle COMMANDEMENT (ou un rôle listé dans
 * config.roles.moderation), utilisé pour protéger les commandes sensibles.
 * @param {import('discord.js').GuildMember} member
 * @param {string[]} allowedRoleNames
 */
function hasStaffRole(member, allowedRoleNames) {
  if (!member) return false;
  if (member.permissions.has("Administrator")) return true;
  return member.roles.cache.some((role) =>
    allowedRoleNames.some(
      (name) => name.toLowerCase() === role.name.toLowerCase()
    )
  );
}

module.exports = { findRole, findChannel, hasStaffRole };
