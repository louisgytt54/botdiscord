// ============================================================================
// utils/embeds.js — constructeurs d'embeds réutilisés partout dans le bot,
// pour garder un style visuel cohérent (couleur, footer, icône...).
// ============================================================================

const { EmbedBuilder } = require("discord.js");
const config = require("../config");

function baseEmbed() {
  const embed = new EmbedBuilder()
    .setColor(config.branding.color)
    .setFooter({ text: config.branding.footer });
  if (config.branding.iconURL) {
    embed.setFooter({
      text: config.branding.footer,
      iconURL: config.branding.iconURL,
    });
  }
  embed.setTimestamp();
  return embed;
}

function successEmbed(title, description) {
  return baseEmbed()
    .setColor(config.branding.colorSuccess)
    .setTitle(`✅ ${title}`)
    .setDescription(description || null);
}

function errorEmbed(title, description) {
  return baseEmbed()
    .setColor(config.branding.colorDanger)
    .setTitle(`❌ ${title}`)
    .setDescription(description || null);
}

function warningEmbed(title, description) {
  return baseEmbed()
    .setColor(config.branding.colorWarning)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description || null);
}

function modLogEmbed({ action, target, moderator, reason, extra }) {
  const embed = baseEmbed()
    .setColor(config.branding.colorDanger)
    .setTitle(`🛡️ Action de modération : ${action}`)
    .addFields(
      { name: "Membre", value: `${target}`, inline: true },
      { name: "Modérateur", value: `${moderator}`, inline: true },
      { name: "Raison", value: reason || "Aucune raison fournie", inline: false }
    );
  if (extra) embed.addFields({ name: "Détails", value: extra });
  return embed;
}

module.exports = {
  baseEmbed,
  successEmbed,
  errorEmbed,
  warningEmbed,
  modLogEmbed,
};
