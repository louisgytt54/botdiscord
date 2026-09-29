// ============================================================================
// Attribue automatiquement le rôle ARM à tout nouveau membre, et log son arrivée.
// ============================================================================

const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");
const { findRole } = require("../utils/resolve");
const { baseEmbed } = require("../utils/embeds");
const { log } = require("../utils/logger");
const { getOrCreateWelcomeChannel } = require("../utils/welcomeChannel");
const { generateWelcomeCard } = require("../utils/welcomeCard");

module.exports = {
  name: "guildMemberAdd",
  async execute(member) {
    try {
      const role = findRole(member.guild, config.roles.base);
      if (role) {
        await member.roles.add(role);
      } else {
        console.warn(`[guildMemberAdd] Rôle de base "${config.roles.base}" introuvable.`);
      }
    } catch (err) {
      console.error("[guildMemberAdd] Erreur lors de l'attribution du rôle ARM :", err.message);
    }

    await log(
      member.guild,
      "server",
      baseEmbed()
        .setTitle("📥 Nouveau membre")
        .setDescription(`${member} (${member.user.tag}) a rejoint le serveur.`)
        .addFields({
          name: "Compte créé",
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        })
    );

    // Carte "nouveau régulateur" dans le salon dédié (lecture seule pour
    // tout le monde). Ne doit jamais faire planter le bot si la génération
    // d'image échoue (ex. dépendance @napi-rs/canvas pas encore installée).
    try {
      const channel = await getOrCreateWelcomeChannel(member.guild);
      const buffer = await generateWelcomeCard({ member, type: "join" });
      const attachment = new AttachmentBuilder(buffer, { name: "arrivee.png" });
      const embed = new EmbedBuilder().setColor(0x2ecc71).setImage("attachment://arrivee.png");
      await channel.send({
        content: `${member} vient de rejoindre le serveur 👋`,
        embeds: [embed],
        files: [attachment],
        allowedMentions: { users: [member.id] },
      });
    } catch (err) {
      console.error("[guildMemberAdd] Erreur carte de bienvenue :", err.message);
    }
  },
};
