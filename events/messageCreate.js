// ============================================================================
// Relais d'annonces : tout message envoyé dans le salon configuré
// (config.channels.annonceRelay) par un membre du COMMANDEMENT est supprimé
// puis republié par le bot sous forme d'embed, avec en footer le nom de
// l'auteur d'origine (discret, pour la traçabilité interne).
// ============================================================================

const config = require("../config");
const { findChannel, hasStaffRole } = require("../utils/resolve");
const { baseEmbed } = require("../utils/embeds");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const relayChannel = findChannel(message.guild, config.channels.annonceRelay);
    if (!relayChannel || message.channel.id !== relayChannel.id) return;

    // Seuls les membres autorisés peuvent utiliser le relais d'annonces.
    if (!hasStaffRole(message.member, [config.roles.commandement, ...config.roles.moderation])) {
      // On laisse un petit message d'explication, supprimé après quelques secondes.
      const warn = await message.reply({
        content: `⚠️ Ce salon est réservé aux annonces officielles. Seul le rôle **${config.roles.commandement}** peut y écrire.`,
      });
      await message.delete().catch(() => {});
      setTimeout(() => warn.delete().catch(() => {}), 6000);
      return;
    }

    const content = message.content?.trim();
    const attachment = message.attachments.first();

    // Si le message est vide (juste une image par ex.), on republie quand même.
    const embed = baseEmbed()
      .setAuthor({
        name: config.branding.name,
        iconURL: message.client.user.displayAvatarURL(),
      })
      .setDescription(content && content.length > 0 ? content : null);

    if (attachment && attachment.contentType?.startsWith("image/")) {
      embed.setImage(attachment.url);
    }

    await relayChannel.send({ embeds: [embed] });
    await message.delete().catch(() => {});
  },
};
