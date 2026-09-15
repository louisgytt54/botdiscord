// ============================================================================
// /ticket panneau — poste un message avec un bouton "🎫 Ouvrir un ticket"
// dans le salon configuré (config.channels.ticketPanel). La création du
// salon de ticket et sa fermeture sont gérées dans events/interactionCreate.js
// ============================================================================

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const config = require("../config");
const { hasStaffRole } = require("../utils/resolve");
const { errorEmbed, baseEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Gestion du système de tickets")
    .addSubcommand((sub) =>
      sub
        .setName("panneau")
        .setDescription("Poster le panneau d'ouverture de ticket dans ce salon")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!hasStaffRole(interaction.member, [config.roles.commandement])) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Permission refusée",
            `Seul le rôle **${config.roles.commandement}** peut poster le panneau de tickets.`
          ),
        ],
        ephemeral: true,
      });
    }

    // interaction.channel.send() est un appel Discord qui peut dépasser la
    // fenêtre de 3s.
    await interaction.deferReply({ ephemeral: true });

    const embed = baseEmbed()
      .setTitle("🎫 Support — PC Secours")
      .setDescription(
        "Besoin d'aide, d'un signalement à faire ou d'une question pour le COMMANDEMENT ?\n\nClique sur le bouton ci-dessous pour ouvrir un ticket privé."
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("Ouvrir un ticket")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: "✅ Panneau de tickets posté." });
  },
};
