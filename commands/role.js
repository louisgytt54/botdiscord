// ============================================================================
// /role — gestion des rôles par le COMMANDEMENT :
//   /role commandement <membre>      → promeut un membre au rôle COMMANDEMENT
//   /role service <membre> <service> → attribue un rôle Police/Gendarmerie/Pompier/SAMU 112
//   /role retirer <membre> <role>    → retire un rôle géré par le bot
// ============================================================================

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../config");
const { hasStaffRole, findRole } = require("../utils/resolve");
const { successEmbed, errorEmbed } = require("../utils/embeds");
const { log } = require("../utils/logger");
const { baseEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Gestion des rôles (COMMANDEMENT uniquement)")
    .addSubcommand((sub) =>
      sub
        .setName("commandement")
        .setDescription("Promouvoir un membre au rôle COMMANDEMENT")
        .addUserOption((o) =>
          o.setName("membre").setDescription("Membre à promouvoir").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("service")
        .setDescription("Attribuer un rôle de service à un membre")
        .addUserOption((o) =>
          o.setName("membre").setDescription("Membre concerné").setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName("service")
            .setDescription("Service à attribuer")
            .setRequired(true)
            .addChoices(
              { name: "Police", value: "Police" },
              { name: "Gendarmerie", value: "Gendarmerie" },
              { name: "Pompier", value: "Pompier" },
              { name: "SAMU 112", value: "SAMU 112" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("retirer")
        .setDescription("Retirer un rôle géré par le bot à un membre")
        .addUserOption((o) =>
          o.setName("membre").setDescription("Membre concerné").setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName("role")
            .setDescription("Rôle à retirer")
            .setRequired(true)
            .addChoices(
              { name: "COMMANDEMENT", value: "COMMANDEMENT" },
              { name: "Police", value: "Police" },
              { name: "Gendarmerie", value: "Gendarmerie" },
              { name: "Pompier", value: "Pompier" },
              { name: "SAMU 112", value: "SAMU 112" },
              { name: "Opérateur", value: "Opérateur" }
            )
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const staff = interaction.member;
    if (!hasStaffRole(staff, [config.roles.commandement])) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Permission refusée",
            `Seul le rôle **${config.roles.commandement}** peut gérer les rôles.`
          ),
        ],
        ephemeral: true,
      });
    }

    // Récupérer le membre + ajouter/retirer un rôle sont des appels Discord
    // qui peuvent dépasser la fenêtre de 3s : on défère avant.
    await interaction.deferReply();

    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser("membre");
    const targetMember = await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!targetMember) {
      return interaction.editReply({
        embeds: [errorEmbed("Introuvable", "Ce membre n'est plus sur le serveur.")],
      });
    }

    if (sub === "commandement") {
      const role = findRole(interaction.guild, config.roles.commandement);
      if (!role) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              "Rôle introuvable",
              `Le rôle **${config.roles.commandement}** n'existe pas sur ce serveur.`
            ),
          ],
        });
      }
      await targetMember.roles.add(role);
      await interaction.editReply({
        embeds: [
          successEmbed(
            "Promotion effectuée",
            `${targetMember} a été promu **${config.roles.commandement}**.`
          ),
        ],
      });
      await log(
        interaction.guild,
        "server",
        baseEmbed()
          .setTitle("👑 Promotion COMMANDEMENT")
          .setDescription(
            `${targetMember} promu par ${interaction.user} au rôle **${config.roles.commandement}**.`
          )
      );
      return;
    }

    if (sub === "service") {
      const service = interaction.options.getString("service");
      const role = findRole(interaction.guild, service);
      if (!role) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              "Rôle introuvable",
              `Le rôle **${service}** n'existe pas sur ce serveur. Vérifie qu'il n'a pas été supprimé.`
            ),
          ],
        });
      }
      await targetMember.roles.add(role);
      await interaction.editReply({
        embeds: [
          successEmbed(
            "Service attribué",
            `${targetMember} est maintenant **${service}**.`
          ),
        ],
      });
      await log(
        interaction.guild,
        "server",
        baseEmbed()
          .setTitle("🎖️ Rôle de service attribué")
          .setDescription(
            `${targetMember} a reçu le rôle **${service}** (attribué par ${interaction.user}).`
          )
      );
      return;
    }

    if (sub === "retirer") {
      const roleName = interaction.options.getString("role");
      const role = findRole(interaction.guild, roleName);
      if (!role || !targetMember.roles.cache.has(role.id)) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              "Rien à retirer",
              `${targetMember} n'a pas le rôle **${roleName}**.`
            ),
          ],
        });
      }
      await targetMember.roles.remove(role);
      await interaction.editReply({
        embeds: [
          successEmbed(
            "Rôle retiré",
            `Le rôle **${roleName}** a été retiré à ${targetMember}.`
          ),
        ],
      });
      await log(
        interaction.guild,
        "server",
        baseEmbed()
          .setTitle("🗑️ Rôle retiré")
          .setDescription(
            `${interaction.user} a retiré **${roleName}** à ${targetMember}.`
          )
      );
    }
  },
};
