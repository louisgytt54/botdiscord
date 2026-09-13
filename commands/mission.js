// ============================================================================
// /mission — ouvre un questionnaire (modal) pour proposer une idée de mission.
// Accessible à tout le monde (pas réservé au COMMANDEMENT) : n'importe quel
// membre peut proposer une mission, elle est envoyée dans le salon de
// validation, et le COMMANDEMENT peut l'accepter ou la refuser par bouton.
// ============================================================================

const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mission")
    .setDescription("Proposer une idée de nouvelle mission au COMMANDEMENT"),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId("mission_modal")
      .setTitle("Proposition de mission");

    const nom = new TextInputBuilder()
      .setCustomId("mission_nom")
      .setLabel("Nom de la mission")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const moyens = new TextInputBuilder()
      .setCustomId("mission_moyens")
      .setLabel("Moyens à déclencher (véhicules, unités...)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    const victimes = new TextInputBuilder()
      .setCustomId("mission_victimes")
      .setLabel("Y a-t-il des victimes ? (Oui / Non)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const details = new TextInputBuilder()
      .setCustomId("mission_details")
      .setLabel("Détails / scénario de la mission")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nom),
      new ActionRowBuilder().addComponents(moyens),
      new ActionRowBuilder().addComponents(victimes),
      new ActionRowBuilder().addComponents(details)
    );

    await interaction.showModal(modal);
  },
};
