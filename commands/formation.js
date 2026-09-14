// ============================================================================
// /formation — gestion du catalogue de formations du jeu (public.training_catalog).
// Créer/lister/activer/désactiver une formation : le jeu la reflète au
// prochain affichage du panneau Alliance, sans déploiement.
// ============================================================================

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { baseEmbed, successEmbed, errorEmbed } = require("../utils/embeds");
const { isRecruiter } = require("../services/permissions");
const { SERVICES } = require("../config/services");
const { listTrainings, createTraining, setTrainingActive, TrainingError } = require("../services/supabase/trainings");

const BUILDING_TYPES = [
  { name: "Commissariat", value: "commissariat" },
  { name: "CIS (caserne pompiers)", value: "cis" },
  { name: "Base SMUR", value: "smur-base" },
  { name: "Gendarmerie", value: "gendarmerie" },
  { name: "Hôpital", value: "hopital" },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("formation")
    .setDescription("Gestion du catalogue de formations du jeu")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("creer")
        .setDescription("Créer une formation dans le catalogue")
        .addStringOption((o) => o.setName("slug").setDescription("Identifiant unique, ex : maitre-chien").setRequired(true))
        .addStringOption((o) => o.setName("label").setDescription("Nom affiché, ex : Maître-chien").setRequired(true))
        .addStringOption((o) => o.setName("description").setDescription("Description affichée en jeu").setRequired(true).setMaxLength(500))
        .addIntegerOption((o) => o.setName("cout").setDescription("Coût en crédits par agent").setRequired(true).setMinValue(0))
        .addIntegerOption((o) => o.setName("duree").setDescription("Durée en minutes").setRequired(true).setMinValue(1))
        .addIntegerOption((o) => o.setName("effectif-max").setDescription("Agents max par session (1-12)").setRequired(true).setMinValue(1).setMaxValue(12))
        .addStringOption((o) =>
          o.setName("batiment").setDescription("Bâtiment requis").setRequired(true).addChoices(...BUILDING_TYPES)
        )
        .addStringOption((o) =>
          o
            .setName("service")
            .setDescription("Service concerné")
            .setRequired(true)
            .addChoices(...SERVICES.map((s) => ({ name: s.label, value: s.slug })))
        )
        .addStringOption((o) => o.setName("vehicule-debloque").setDescription("Type de véhicule débloqué (ex : CANIN, CCR) — laisser vide sinon").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("liste").setDescription("Lister le catalogue de formations"))
    .addSubcommand((sub) =>
      sub
        .setName("activer")
        .setDescription("Rendre une formation visible en jeu")
        .addStringOption((o) => o.setName("slug").setDescription("Slug de la formation").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("desactiver")
        .setDescription("Masquer une formation en jeu (sans la supprimer)")
        .addStringOption((o) => o.setName("slug").setDescription("Slug de la formation").setRequired(true))
    ),

  async execute(interaction) {
    if (!isRecruiter(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("Permission refusée", "Réservé au staff.")], ephemeral: true });
    }

    // Voir commands/membre.js : on défère avant le premier appel Supabase
    // pour éviter un "Unknown interaction" (10062) si ça prend plus de 3s.
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === "creer") {
      const payload = {
        slug: interaction.options.getString("slug", true).trim().toLowerCase(),
        label: interaction.options.getString("label", true),
        description: interaction.options.getString("description", true),
        cost_per_staff: interaction.options.getInteger("cout", true),
        duration_minutes: interaction.options.getInteger("duree", true),
        max_staff_per_session: interaction.options.getInteger("effectif-max", true),
        requires_building_type: interaction.options.getString("batiment", true),
        service_slug: interaction.options.getString("service", true),
        unlocks_vehicle_type: interaction.options.getString("vehicule-debloque") || null,
        active: true,
      };

      try {
        const training = await createTraining(payload);
        return interaction.editReply({
          embeds: [successEmbed("Formation créée", `**${training.label}** (\`${training.slug}\`) est active et visible en jeu.`)],
        });
      } catch (err) {
        if (err instanceof TrainingError) {
          return interaction.editReply({ embeds: [errorEmbed("Impossible de créer la formation", err.message)] });
        }
        console.error("[formation] Erreur création :", err);
        return interaction.editReply({ embeds: [errorEmbed("Erreur", "Une erreur inattendue est survenue.")] });
      }
    }

    if (sub === "liste") {
      const trainings = await listTrainings();
      if (trainings.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed("Catalogue vide", "Aucune formation créée. Utilise /formation creer.")] });
      }

      const bySlug = {};
      for (const t of trainings) {
        (bySlug[t.service_slug] ||= []).push(t);
      }

      const embed = baseEmbed().setTitle("📚 Catalogue de formations");
      for (const service of SERVICES) {
        const list = bySlug[service.slug];
        if (!list || list.length === 0) continue;
        embed.addFields({
          name: `${service.emoji} ${service.label}`,
          value: list
            .map(
              (t) =>
                `${t.active ? "🟢" : "⚪"} **${t.label}** (\`${t.slug}\`) — ${t.cost_per_staff} crédits/agent, ${t.duration_minutes} min, max ${t.max_staff_per_session}${
                  t.unlocks_vehicle_type ? ` — débloque ${t.unlocks_vehicle_type}` : ""
                }`
            )
            .join("\n"),
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === "activer" || sub === "desactiver") {
      const slug = interaction.options.getString("slug", true).trim().toLowerCase();
      const training = await setTrainingActive(slug, sub === "activer");
      if (!training) {
        return interaction.editReply({ embeds: [errorEmbed("Introuvable", `Aucune formation avec le slug \`${slug}\`.`)] });
      }
      return interaction.editReply({
        embeds: [successEmbed(sub === "activer" ? "Formation activée" : "Formation désactivée", `**${training.label}** est maintenant ${sub === "activer" ? "visible" : "masquée"} en jeu.`)],
      });
    }
  },
};
