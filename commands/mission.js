// ============================================================================
// /mission panneau — poste un bouton "Proposer une mission" dans ce salon.
// N'importe quel membre peut cliquer dessus pour remplir le formulaire de
// proposition ; la proposition est envoyée dans le salon de validation, et le
// COMMANDEMENT peut l'accepter ou la refuser par bouton (voir interactionCreate.js).
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
    .setName("mission")
    .setDescription("Gestion des propositions de mission")
    .addSubcommand((sub) =>
      sub
        .setName("panneau")
        .setDescription("Poster le panneau de proposition de mission dans ce salon")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!hasStaffRole(interaction.member, [config.roles.commandement])) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Permission refusée",
            `Seul le rôle **${config.roles.commandement}** peut poster le panneau de proposition de mission.`
          ),
        ],
        ephemeral: true,
      });
    }

    // interaction.channel.send() est un appel Discord qui peut dépasser la
    // fenêtre de 3s.
    await interaction.deferReply({ ephemeral: true });

    const embed = baseEmbed()
      .setTitle("🆕 Proposer une mission")
      .setDescription(
        "Tu as une idée de mission pour le serveur ? Clique sur le bouton ci-dessous pour remplir le formulaire (nom, moyens à déclencher, victimes, détails). Le COMMANDEMENT validera ou refusera ta proposition."
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("mission_open")
        .setLabel("Proposer une mission")
        .setEmoji("🆕")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: "✅ Panneau de proposition de mission posté." });
  },
};
