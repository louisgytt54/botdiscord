// ============================================================================
// /candidature panneau — poste le panneau "🚨 REJOINDRE UN SERVICE" avec un
// select menu des services. La suite du parcours (département -> centre ->
// confirmation -> formulaire) est gérée dans events/interactionCreate.js.
// ============================================================================

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const config = require("../config");
const { isRecruiter } = require("../services/permissions");
const { errorEmbed, baseEmbed } = require("../utils/embeds");
const { listServiceRows } = require("../services/supabase/catalog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("candidature")
    .setDescription("Gestion des candidatures de service")
    .addSubcommand((sub) =>
      sub
        .setName("panneau")
        .setDescription("Poster le panneau « Rejoindre un service » dans ce salon")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    if (!isRecruiter(interaction.member)) {
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

    // listServiceRows() (Supabase) + channel.send() (Discord) suivent :
    // on défère avant pour éviter un "Unknown interaction" (10062).
    await interaction.deferReply({ ephemeral: true });

    const services = await listServiceRows();
    const activeServices = services.filter((s) => s.active !== false);

    if (activeServices.length === 0) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            "Aucun service disponible",
            "Aucun service actif n'est configuré dans Supabase pour le moment."
          ),
        ],
      });
    }

    const embed = baseEmbed()
      .setTitle("🚨 REJOINDRE UN SERVICE")
      .setDescription(
        "Intégrez l'un des centres opérationnels du jeu et participez à la gestion des interventions.\n\nChoisissez ci-dessous le service que vous souhaitez rejoindre."
      );

    const select = new StringSelectMenuBuilder()
      .setCustomId("candidature_select_service")
      .setPlaceholder("Choisissez un service...")
      .addOptions(
        activeServices.map((s) => ({
          label: s.label,
          value: s.slug,
          description: `${s.centerTypeLabel || ""}`.slice(0, 100) || undefined,
          emoji: s.emoji || undefined,
        }))
      );

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: "✅ Panneau « Rejoindre un service » posté." });
  },
};
