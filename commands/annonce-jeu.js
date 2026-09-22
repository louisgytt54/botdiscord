// ============================================================================
// /annonce-jeu — publie une annonce à la fois dans Discord (comme /annonce)
// ET dans la table Supabase `operational_announcements`, pour qu'elle
// apparaisse dans le dossier CENTRE OPÉRATIONNEL du jeu (mise à jour 0055).
// Commande dédiée (ne modifie pas /annonce) pour ne pas changer le
// comportement Discord-only existant.
// ============================================================================

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const config = require("../config");
const { hasStaffRole } = require("../utils/resolve");
const { baseEmbed, errorEmbed, warningEmbed } = require("../utils/embeds");
const { insertAnnouncement, PRIORITY_LABELS } = require("../services/supabase/support");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("annonce-jeu")
    .setDescription(
      "Publie une annonce CENTRE OPÉRATIONNEL, visible dans Discord et dans le jeu."
    )
    .addStringOption((opt) =>
      opt.setName("titre").setDescription("Titre / objet de l'annonce").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("Contenu de l'annonce. Utilise \\n pour aller à la ligne.")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("priorite")
        .setDescription("Priorité de l'annonce (par défaut : normal)")
        .addChoices(
          { name: "🔴 Urgent", value: "urgent" },
          { name: "🟠 Normal", value: "normal" },
          { name: "🔵 Info", value: "info" }
        )
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName("salon")
        .setDescription("Salon Discord où publier l'annonce (par défaut : le salon actuel)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!hasStaffRole(interaction.member, [config.roles.commandement, ...config.roles.moderation])) {
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

    // salon.send() + l'insertion Supabase sont deux appels réseau qui
    // peuvent dépasser la fenêtre de 3s : on défère tout de suite.
    await interaction.deferReply({ ephemeral: true });

    const titre = interaction.options.getString("titre");
    const message = interaction.options.getString("message").replace(/\\n/g, "\n");
    const priorite = interaction.options.getString("priorite") || "normal";
    const salon = interaction.options.getChannel("salon") || interaction.channel;

    if (!salon.isTextBased()) {
      return interaction.editReply({
        embeds: [errorEmbed("Salon invalide", "Choisis un salon textuel.")],
      });
    }

    const embed = baseEmbed()
      .setTitle(`${PRIORITY_LABELS[priorite]} — ${titre}`)
      .setDescription(message)
      .setAuthor({
        name: `${config.branding.name} — Centre opérationnel`,
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    const sent = await salon.send({ embeds: [embed] });

    const result = await insertAnnouncement({
      subject: titre,
      body: message,
      priority: priorite,
      discordMessageId: sent.id,
    });

    if (result.error) {
      await interaction.editReply({
        embeds: [
          warningEmbed(
            "Annonce publiée dans Discord, mais pas dans le jeu",
            `L'annonce a bien été publiée dans ${salon}, mais son enregistrement côté jeu a échoué (${result.error}). Vérifie que la mise à jour 0055 a bien été exécutée sur Supabase.`
          ),
        ],
      });
      return;
    }

    await interaction.editReply({
      content: `✅ Annonce publiée dans ${salon} et transmise au jeu (CENTRE OPÉRATIONNEL).`,
    });
  },
};
