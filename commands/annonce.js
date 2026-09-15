// ============================================================================
// /annonce — permet à un membre du COMMANDEMENT de faire publier par le bot
// un embed "propre" (titre + description + liste de liens optionnelle),
// exactement dans le style de l'exemple "Voici les liens utiles du SDIS France."
// ============================================================================

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const config = require("../config");
const { hasStaffRole, findRole } = require("../utils/resolve");
const { baseEmbed, errorEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("annonce")
    .setDescription(
      "Publie une annonce officielle sous forme d'embed, au nom du bot."
    )
    .addStringOption((opt) =>
      opt
        .setName("titre")
        .setDescription("Titre de l'annonce")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription(
          "Contenu de l'annonce. Utilise \\n pour aller à la ligne, et - pour une puce."
        )
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName("salon")
        .setDescription(
          "Salon où publier l'annonce (par défaut : le salon actuel)"
        )
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("image")
        .setDescription("URL d'une image à afficher dans l'embed (optionnel)")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("couleur")
        .setDescription("Couleur hex de l'embed, ex: #c0392b (optionnel)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const member = interaction.member;
    if (!hasStaffRole(member, [config.roles.commandement, ...config.roles.moderation])) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Permission refusée",
            `Seul le rôle **${config.roles.commandement}** peut utiliser cette commande.`
          ),
        ],
        ephemeral: true,
      });
    }

    // salon.send() est un appel Discord qui peut dépasser la fenêtre de 3s.
    await interaction.deferReply({ ephemeral: true });

    const titre = interaction.options.getString("titre");
    const message = interaction.options.getString("message").replace(/\\n/g, "\n");
    const salon = interaction.options.getChannel("salon") || interaction.channel;
    const image = interaction.options.getString("image");
    const couleurRaw = interaction.options.getString("couleur");

    const embed = baseEmbed().setTitle(titre).setDescription(message);

    if (image) embed.setImage(image);
    if (couleurRaw) {
      const hex = couleurRaw.replace("#", "");
      if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        embed.setColor(parseInt(hex, 16));
      }
    }
    embed.setAuthor({
      name: config.branding.name,
      iconURL: interaction.client.user.displayAvatarURL(),
    });

    if (!salon.isTextBased()) {
      return interaction.editReply({
        embeds: [errorEmbed("Salon invalide", "Choisis un salon textuel.")],
      });
    }

    await salon.send({ embeds: [embed] });
    await interaction.editReply({
      content: `✅ Annonce publiée dans ${salon}.`,
    });
  },
};
