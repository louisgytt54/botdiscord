// ============================================================================
// utils/logger.js — envoie un embed dans le salon de logs configuré
// (server-logs ou mod-logs). Ne plante jamais le bot si le salon est introuvable.
// ============================================================================

const { findChannel } = require("./resolve");
const config = require("../config");

/**
 * @param {import('discord.js').Guild} guild
 * @param {"mod"|"server"} type
 * @param {import('discord.js').EmbedBuilder} embed
 */
async function log(guild, type, embed) {
  try {
    const channelName =
      type === "mod" ? config.channels.modLogs : config.channels.serverLogs;
    const channel = findChannel(guild, channelName);
    if (!channel || !channel.isTextBased()) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[logger] Impossible d'envoyer le log :", err.message);
  }
}

module.exports = { log };
