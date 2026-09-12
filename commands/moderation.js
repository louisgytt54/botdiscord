// ============================================================================
// Commandes de modération classiques : /ban /kick /mute /unmute /warn /warnings
// Toutes protégées par le rôle COMMANDEMENT et loggées dans #mod-logs.
// ============================================================================

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../config");
const { hasStaffRole } = require("../utils/resolve");
const { successEmbed, errorEmbed, modLogEmbed, baseEmbed } = require("../utils/embeds");
const { log } = require("../utils/logger");
const { addWarning, getWarnings, clearWarnings } = require("../utils/storage");

function checkStaff(interaction) {
  if (!hasStaffRole(interaction.member, config.roles.moderation.concat(config.roles.commandement))) {
    return errorEmbed(
      "Permission refusée",
      `Seul le rôle **${config.roles.commandement}** peut utiliser les commandes de modération.`
    );
  }
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mod")
    .setDescription("Commandes de modération")
    .addSubcommand((sub) =>
      sub
        .setName("ban")
        .setDescription("Bannir un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre à bannir").setRequired(true))
        .addStringOption((o) => o.setName("raison").setDescription("Raison du bannissement").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("kick")
        .setDescription("Expulser un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre à expulser").setRequired(true))
        .addStringOption((o) => o.setName("raison").setDescription("Raison de l'expulsion").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("mute")
        .setDescription("Mettre un membre en sourdine (timeout)")
        .addUserOption((o) => o.setName("membre").setDescription("Membre à mute").setRequired(true))
        .addIntegerOption((o) =>
          o.setName("minutes").setDescription("Durée en minutes").setRequired(true)
        )
        .addStringOption((o) => o.setName("raison").setDescription("Raison du mute").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("unmute")
        .setDescription("Retirer la sourdine d'un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre à démute").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("warn")
        .setDescription("Avertir un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre à avertir").setRequired(true))
        .addStringOption((o) => o.setName("raison").setDescription("Raison de l'avertissement").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("warnings")
        .setDescription("Voir les avertissements d'un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre concerné").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("clearwarnings")
        .setDescription("Effacer les avertissements d'un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre concerné").setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const denial = checkStaff(interaction);
    if (denial) return interaction.reply({ embeds: [denial], ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser("membre");
    const reason = interaction.options.getString("raison") || "Aucune raison fournie";
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    // ---------------- BAN ----------------
    if (sub === "ban") {
      if (targetMember && !targetMember.bannable) {
        return interaction.reply({
          embeds: [errorEmbed("Impossible", "Je ne peux pas bannir ce membre (rôle trop élevé).")],
          ephemeral: true,
        });
      }
      await interaction.guild.members.ban(targetUser.id, { reason });
      await interaction.reply({ embeds: [successEmbed("Membre banni", `${targetUser} a été banni.`)] });
      await log(interaction.guild, "mod", modLogEmbed({ action: "Ban", target: targetUser, moderator: interaction.user, reason }));
      return;
    }

    // ---------------- KICK ----------------
    if (sub === "kick") {
      if (!targetMember) {
        return interaction.reply({ embeds: [errorEmbed("Introuvable", "Ce membre n'est plus sur le serveur.")], ephemeral: true });
      }
      if (!targetMember.kickable) {
        return interaction.reply({ embeds: [errorEmbed("Impossible", "Je ne peux pas expulser ce membre (rôle trop élevé).")], ephemeral: true });
      }
      await targetMember.kick(reason);
      await interaction.reply({ embeds: [successEmbed("Membre expulsé", `${targetUser} a été expulsé.`)] });
      await log(interaction.guild, "mod", modLogEmbed({ action: "Kick", target: targetUser, moderator: interaction.user, reason }));
      return;
    }

    // ---------------- MUTE ----------------
    if (sub === "mute") {
      const minutes = interaction.options.getInteger("minutes");
      if (!targetMember) {
        return interaction.reply({ embeds: [errorEmbed("Introuvable", "Ce membre n'est plus sur le serveur.")], ephemeral: true });
      }
      if (minutes < 1 || minutes > config.settings.maxMuteMinutes) {
        return interaction.reply({
          embeds: [errorEmbed("Durée invalide", `Choisis une durée entre 1 et ${config.settings.maxMuteMinutes} minutes.`)],
          ephemeral: true,
        });
      }
      if (!targetMember.moderatable) {
        return interaction.reply({ embeds: [errorEmbed("Impossible", "Je ne peux pas mute ce membre (rôle trop élevé).")], ephemeral: true });
      }
      await targetMember.timeout(minutes * 60 * 1000, reason);
      await interaction.reply({ embeds: [successEmbed("Membre mute", `${targetUser} est en sourdine pour ${minutes} minute(s).`)] });
      await log(interaction.guild, "mod", modLogEmbed({ action: "Mute", target: targetUser, moderator: interaction.user, reason, extra: `${minutes} minute(s)` }));
      return;
    }

    // ---------------- UNMUTE ----------------
    if (sub === "unmute") {
      if (!targetMember) {
        return interaction.reply({ embeds: [errorEmbed("Introuvable", "Ce membre n'est plus sur le serveur.")], ephemeral: true });
      }
      await targetMember.timeout(null);
      await interaction.reply({ embeds: [successEmbed("Sourdine retirée", `${targetUser} peut de nouveau parler.`)] });
      await log(interaction.guild, "mod", modLogEmbed({ action: "Unmute", target: targetUser, moderator: interaction.user, reason: "—" }));
      return;
    }

    // ---------------- WARN ----------------
    if (sub === "warn") {
      const warnings = addWarning(targetUser.id, {
        reason,
        moderator: interaction.user.tag,
        date: new Date().toISOString(),
      });
      await interaction.reply({
        embeds: [successEmbed("Membre averti", `${targetUser} a reçu un avertissement (total : ${warnings.length}).`)],
      });
      await log(interaction.guild, "mod", modLogEmbed({ action: "Warn", target: targetUser, moderator: interaction.user, reason, extra: `Total avertissements : ${warnings.length}` }));

      // Tente d'envoyer un MP au membre averti
      targetUser.send({
        embeds: [
          baseEmbed()
            .setTitle("⚠️ Vous avez reçu un avertissement")
            .setDescription(`Serveur : **${interaction.guild.name}**\nRaison : ${reason}`),
        ],
      }).catch(() => {});
      return;
    }

    // ---------------- WARNINGS (liste) ----------------
    if (sub === "warnings") {
      const warnings = getWarnings(targetUser.id);
      if (warnings.length === 0) {
        return interaction.reply({
          embeds: [baseEmbed().setTitle(`Avertissements de ${targetUser.tag}`).setDescription("Aucun avertissement.")],
          ephemeral: true,
        });
      }
      const list = warnings
        .map((w, i) => `**${i + 1}.** ${w.reason} — *par ${w.moderator}* (<t:${Math.floor(new Date(w.date).getTime() / 1000)}:R>)`)
        .join("\n");
      return interaction.reply({
        embeds: [baseEmbed().setTitle(`Avertissements de ${targetUser.tag} (${warnings.length})`).setDescription(list)],
        ephemeral: true,
      });
    }

    // ---------------- CLEARWARNINGS ----------------
    if (sub === "clearwarnings") {
      clearWarnings(targetUser.id);
      await interaction.reply({ embeds: [successEmbed("Avertissements effacés", `Tous les avertissements de ${targetUser} ont été supprimés.`)] });
      await log(interaction.guild, "mod", modLogEmbed({ action: "Clear Warnings", target: targetUser, moderator: interaction.user, reason: "—" }));
    }
  },
};
