// ============================================================================
// /candidature panneau — poste un message avec un bouton "📋 Postuler" dans
// #candidatures-opérateur. Ouvre un modal pour poser des questions, puis
// publie la candidature avec des boutons Accepter/Refuser pour le COMMANDEMENT.
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
    .setName("candidature")
    .setDescription("Gestion des candidatures opérateur")
    .addSubcommand((sub) =>
      sub
        .setName("panneau")
        .setDescription("Poster le panneau de candidature dans ce salon")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    if (!hasStaffRole(interaction.member, [config.roles.commandement])) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Permission refusée",
            `Seul le rôle **${config.roles.commandement}** peut poster le panneau de candidature.`
          ),
        ],
        ephemeral: true,
      });
    }

    const embed = baseEmbed()
      .setTitle("📋 Candidature Opérateur")
      .setDescription(
        "Tu veux rejoindre l'équipe des opérateurs de régulation (15-17-18-112) ?\n\nClique sur **Postuler** pour remplir ta candidature."
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("candidature_open")
        .setLabel("Postuler")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: "✅ Panneau de candidature posté.", ephemeral: true });
  },
};
