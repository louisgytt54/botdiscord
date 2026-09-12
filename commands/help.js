const { SlashCommandBuilder } = require("discord.js");
const { baseEmbed } = require("../utils/embeds");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Affiche la liste des commandes du bot PC Secours Admin."),

  async execute(interaction) {
    const embed = baseEmbed()
      .setTitle(`📖 Commandes de ${config.branding.name}`)
      .setDescription(
        [
          "**Rôles**",
          "`/role commandement <membre>` — promouvoir un membre au COMMANDEMENT",
          "`/role service <membre> <service>` — attribuer Police/Gendarmerie/Pompier/SAMU 112",
          "`/role retirer <membre> <role>` — retirer un rôle",
          "",
          "**Modération**",
          "`/mod ban|kick|mute|unmute|warn|warnings|clearwarnings`",
          "",
          "**Salons**",
          "`/salon creer <nom> <type>` — créer un salon",
          "`/salon supprimer <salon>` — supprimer un salon",
          "",
          "**Annonces**",
          "`/annonce <titre> <message>` — publier un embed au nom du bot",
          `Ou écris directement dans #${config.channels.annonceRelay} : ton message sera republié en embed.`,
          "",
          "**Tickets**",
          "`/ticket panneau` — poster le panneau d'ouverture de ticket",
          "",
          "**Candidatures**",
          "`/candidature panneau` — poster le panneau de candidature opérateur",
        ].join("\n")
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
