const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");
const { baseEmbed } = require("../utils/embeds");
const { log } = require("../utils/logger");
const { getOrCreateWelcomeChannel } = require("../utils/welcomeChannel");
const { generateWelcomeCard } = require("../utils/welcomeCard");

module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    await log(
      member.guild,
      "server",
      baseEmbed()
        .setTitle("📤 Départ d'un membre")
        .setDescription(`**${member.user.tag}** a quitté le serveur.`)
    );

    // Carte "régulateur hors ligne" dans le salon dédié (lecture seule pour
    // tout le monde). Ne doit jamais faire planter le bot si la génération
    // d'image échoue (ex. dépendance @napi-rs/canvas pas encore installée).
    try {
      const channel = await getOrCreateWelcomeChannel(member.guild);
      const buffer = await generateWelcomeCard({ member, type: "leave" });
      const attachment = new AttachmentBuilder(buffer, { name: "depart.png" });
      const embed = new EmbedBuilder()
        .setColor(config.branding.colorDanger)
        .setImage("attachment://depart.png");
      await channel.send({
        content: `**${member.user.tag}** vient de quitter le serveur 👋`,
        embeds: [embed],
        files: [attachment],
        allowedMentions: { parse: [] },
      });
    } catch (err) {
      console.error("[guildMemberRemove] Erreur carte de départ :", err.message);
    }
  },
};
