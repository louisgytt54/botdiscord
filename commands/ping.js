const { SlashCommandBuilder } = require("discord.js");
const { baseEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Vérifie que le bot répond bien et affiche sa latence."),

  async execute(interaction) {
    const sent = await interaction.reply({
      content: "🏓 Ping...",
      fetchReply: true,
    });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const embed = baseEmbed()
      .setTitle("🏓 Pong !")
      .addFields(
        { name: "Latence message", value: `${latency}ms`, inline: true },
        {
          name: "Latence API Discord",
          value: `${Math.round(interaction.client.ws.ping)}ms`,
          inline: true,
        }
      );
    await interaction.editReply({ content: null, embeds: [embed] });
  },
};
