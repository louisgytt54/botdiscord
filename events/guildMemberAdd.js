// ============================================================================
// Attribue automatiquement le rôle ARM à tout nouveau membre, et log son arrivée.
// ============================================================================

const config = require("../config");
const { findRole } = require("../utils/resolve");
const { baseEmbed } = require("../utils/embeds");
const { log } = require("../utils/logger");

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
  },
};
