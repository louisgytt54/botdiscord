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
 *
 * Accepte aussi bien un NOM de rôle qu'un ID dans allowedRoleNames (comme
 * findRole/findChannel) : comparer uniquement par nom est fragile (un
 * espace en trop, un emoji collé au nom, une casse différente sur un
 * caractère accentué… et la comparaison échoue silencieusement, même si le
 * rôle est visuellement identique). L'ID est la source de vérité quand il
 * est fourni dans config.js.
 * @param {import('discord.js').GuildMember} member
 * @param {string[]} allowedRoleNames
 */
function hasStaffRole(member, allowedRoleNames) {
  if (!member) return false;
  if (member.permissions.has("Administrator")) return true;
  return member.roles.cache.some((role) =>
    allowedRoleNames.some(
      (nameOrId) =>
        role.id === nameOrId ||
        String(nameOrId).toLowerCase() === role.name.toLowerCase()
    )
  );
}

/**
 * Représentation lisible d'un rôle (configuré par NOM ou par ID) pour les
 * messages du bot : une mention @rôle si le rôle existe sur le serveur,
 * sinon la valeur brute telle quelle. À utiliser à la place d'un
 * `**${config.roles.commandement}**` en dur dans un message, qui afficherait
 * un ID Discord illisible si la config est basculée sur un ID de rôle.
 * @param {import('discord.js').Guild} guild
 * @param {string} nameOrId
 */
function roleLabel(guild, nameOrId) {
  const role = findRole(guild, nameOrId);
  return role ? `${role}` : `**${nameOrId}**`;
}

module.exports = { findRole, findChannel, hasStaffRole, roleLabel };
