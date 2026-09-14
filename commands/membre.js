// ============================================================================
// /membre — gestion des affectations d'un joueur.
// info | affecter | suspendre | reactiver | retirer
// ============================================================================

const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { baseEmbed, errorEmbed } = require("../utils/embeds");
const { isRecruiter } = require("../services/permissions");
const { getProfileByDiscordId } = require("../services/supabase/profiles");
const { listAssignmentsForProfile } = require("../services/assignments");
const { listServiceRows, getCenter, getDepartment } = require("../services/supabase/catalog");

const STATUS_LABELS = {
  pending: "En attente",
  active: "Active",
  suspended: "Suspendue",
  revoked: "Retirée",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("membre")
    .setDescription("Gestion des affectations d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("Affiche les candidatures/affectations d'un membre")
        .addUserOption((opt) => opt.setName("membre").setDescription("Le membre").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("affecter")
        .setDescription("Affecter un membre à un service/département/centre")
        .addUserOption((opt) => opt.setName("membre").setDescription("Le membre").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("suspendre")
        .setDescription("Suspendre une affectation active d'un membre")
        .addUserOption((opt) => opt.setName("membre").setDescription("Le membre").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("reactiver")
        .setDescription("Réactiver une affectation suspendue d'un membre")
        .addUserOption((opt) => opt.setName("membre").setDescription("Le membre").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("retirer")
        .setDescription("Retirer définitivement une affectation d'un membre")
        .addUserOption((opt) => opt.setName("membre").setDescription("Le membre").setRequired(true))
    ),

  async execute(interaction) {
    if (!isRecruiter(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("Permission refusée", "Réservé au staff.")], ephemeral: true });
    }

    // On accuse réception TOUT DE SUITE (avant le moindre appel Supabase) :
    // le bot fait ensuite plusieurs allers-retours en base à la suite, ce qui
    // peut dépasser la fenêtre de 3s de Discord pour un premier reply() et
    // provoquer une erreur "Unknown interaction" (code 10062). deferReply()
    // étend cette fenêtre à 15 minutes ; on utilise editReply() partout après.
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("membre", true);
    const sub = interaction.options.getSubcommand();

    const profile = await getProfileByDiscordId(target.id);
    if (!profile) {
      return interaction.editReply({
        embeds: [errorEmbed("Compte jeu introuvable", `${target} ne s'est jamais connecté au jeu avec Discord.`)],
      });
    }

    if (sub === "info") return handleInfo(interaction, target, profile);
    if (sub === "affecter") return handleAffecter(interaction, target);

    const statusFilter = { suspendre: "active", reactiver: "suspended", retirer: null }[sub];
    const assignments = await listAssignmentsForProfile(profile.id);
    const filtered = statusFilter ? assignments.filter((a) => a.status === statusFilter) : assignments.filter((a) => a.status !== "revoked");

    if (filtered.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed("Aucune affectation", `${target} n'a aucune affectation ${statusFilter ? STATUS_LABELS[statusFilter].toLowerCase() : ""} à traiter.`)],
      });
    }

    const services = await listServiceRows();
    const options = [];
    for (const a of filtered) {
      const center = await getCenter(a.operations_center_id);
      const service = services.find((s) => s.id === a.service_id);
      options.push({
        label: `${service ? service.label : "?"} — ${center ? center.name : "?"}`.slice(0, 100),
        value: a.id,
        description: STATUS_LABELS[a.status],
      });
    }

    const prefix = { suspendre: "masusp", reactiver: "mareact", retirer: "maretire" }[sub];
    const select = new StringSelectMenuBuilder()
      .setCustomId(`${prefix}:${target.id}`)
      .setPlaceholder("Choisissez une affectation...")
      .addOptions(options.slice(0, 25));

    await interaction.editReply({
      embeds: [baseEmbed().setTitle(`${target.tag}`).setDescription("Choisissez l'affectation concernée.")],
      components: [new ActionRowBuilder().addComponents(select)],
    });
  },
};

async function handleAffecter(interaction, target) {
  const services = await listServiceRows();
  const active = services.filter((s) => s.active !== false);
  if (active.length === 0) {
    return interaction.editReply({ embeds: [errorEmbed("Aucun service", "Aucun service actif configuré.")] });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`masvc:${target.id}`)
    .setPlaceholder("Choisissez un service...")
    .addOptions(active.map((s) => ({ label: s.label, value: s.slug, emoji: s.emoji || undefined })));

  await interaction.editReply({
    embeds: [baseEmbed().setTitle(`Affecter ${target.tag}`).setDescription("Choisissez le service.")],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

async function handleInfo(interaction, target, profile) {
  const assignments = await listAssignmentsForProfile(profile.id);
  const services = await listServiceRows();

  if (assignments.length === 0) {
    return interaction.editReply({
      embeds: [baseEmbed().setTitle(`Fiche de ${target.tag}`).setDescription("Aucune candidature ni affectation enregistrée.")],
    });
  }

  const lines = [];
  for (const a of assignments) {
    const center = await getCenter(a.operations_center_id);
    const department = a.department_id ? await getDepartment(a.department_id) : null;
    const service = services.find((s) => s.id === a.service_id);
    lines.push(
      `${service ? service.emoji : "•"} **${service ? service.label : "?"}** — ${center ? center.name : "?"}${
        department ? ` (${department.code})` : ""
      }\nStatut : **${STATUS_LABELS[a.status] || a.status}**${a.suspended_reason ? ` — ${a.suspended_reason}` : ""}${
        a.revoked_reason ? ` — ${a.revoked_reason}` : ""
      }`
    );
  }

  await interaction.editReply({
    embeds: [baseEmbed().setTitle(`Fiche de ${target.tag}`).setDescription(lines.join("\n\n"))],
  });
}
