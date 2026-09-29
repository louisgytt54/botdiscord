// ============================================================================
// utils/welcomeChannel.js — retrouve (ou crée) le salon "nouveau-regulateur"
// utilisé pour annoncer les arrivées/départs de régulateurs.
// Salon en LECTURE SEULE pour tout le monde : personne ne peut y écrire,
// seul le bot y poste les cartes d'arrivée/départ.
// ============================================================================

const { PermissionFlagsBits, ChannelType } = require("discord.js");
const config = require("../config");
const { findChannel } = require("./resolve");

/**
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').TextChannel>}
 */
async function getOrCreateWelcomeChannel(guild) {
  const name = config.channels.regulateurWelcome;

  const existing = findChannel(guild, name);
  if (existing && existing.isTextBased()) return existing;

  const me = guild.members.me;

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    topic:
      "Arrivées et départs des régulateurs — salon en lecture seule, géré automatiquement par le bot.",
    permissionOverwrites: [
      {
        // Personne ne peut écrire ici, seulement lire.
        id: guild.roles.everyone.id,
        deny: [
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.CreatePrivateThreads,
        ],
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      // Le bot doit pouvoir écrire, lui.
      ...(me
        ? [
            {
              id: me.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
              ],
            },
          ]
        : []),
    ],
  });

  return channel;
}

module.exports = { getOrCreateWelcomeChannel };
