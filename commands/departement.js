// ============================================================================
// /departement — administration des départements et centres opérationnels.
// Rien n'est codé en dur : tout passe par Supabase (services/supabase/catalog.js).
// ============================================================================

const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { baseEmbed, successEmbed, errorEmbed } = require("../utils/embeds");
const { isRecruiter } = require("../services/permissions");
const { SERVICES } = require("../config/services");
const {
  addDepartment,
  addCenter,
  listAllDepartments,
  listCentersForService,
} = require("../services/supabase/catalog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("departement")
    .setDescription("Administration des départements et centres opérationnels")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("ajouter-departement")
        .setDescription("Ajouter un département recrutable")
        .addStringOption((o) => o.setName("code").setDescription("Ex : 54").setRequired(true))
        .addStringOption((o) => o.setName("nom").setDescription("Ex : Meurthe-et-Moselle").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("centre-ajouter")
        .setDescription("Ajouter un centre opérationnel")
        .addStringOption((o) =>
          o
            .setName("service")
            .setDescription("Service concerné")
            .setRequired(true)
            .addChoices(...SERVICES.map((s) => ({ name: s.label, value: s.slug })))
        )
        .addStringOption((o) => o.setName("departement").setDescription("Code du département (ex : 54)").setRequired(true))
        .addStringOption((o) => o.setName("type").setDescription("Ex : CTA_CODIS, CIC, CORG, CRRA").setRequired(true))
        .addStringOption((o) => o.setName("nom").setDescription("Ex : CTA-CODIS 54").setRequired(true))
        .addStringOption((o) => o.setName("organisation").setDescription("Ex : SDIS 54").setRequired(false))
        .addRoleOption((o) => o.setName("role").setDescription("Rôle Discord à attribuer pour ce centre").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("centre-gerer")
        .setDescription("Ouvrir/fermer le recrutement ou activer/désactiver un centre")
        .addStringOption((o) =>
          o
            .setName("service")
            .setDescription("Service concerné")
            .setRequired(true)
            .addChoices(...SERVICES.map((s) => ({ name: s.label, value: s.slug })))
        )
    )
    .addSubcommand((sub) => sub.setName("liste").setDescription("Lister les départements et centres configurés")),

  async execute(interaction) {
    if (!isRecruiter(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed("Permission refusée", "Réservé au staff.")], ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "ajouter-departement") {
      const code = interaction.options.getString("code", true);
      const nom = interaction.options.getString("nom", true);
      const dep = await addDepartment({ code, name: nom });
      return interaction.reply({ embeds: [successEmbed("Département ajouté", `**${dep.code} — ${dep.name}**`)], ephemeral: true });
    }

    if (sub === "centre-ajouter") {
      const serviceSlug = interaction.options.getString("service", true);
      const code = interaction.options.getString("departement", true);
      const type = interaction.options.getString("type", true);
      const nom = interaction.options.getString("nom", true);
      const organisation = interaction.options.getString("organisation") || null;
      const role = interaction.options.getRole("role");

      const departments = await listAllDepartments();
      const department = departments.find((d) => d.code === code);
      if (!department) {
        return interaction.reply({
          embeds: [errorEmbed("Département introuvable", `Ajoute-le d'abord avec /departement ajouter-departement (code \`${code}\`).`)],
          ephemeral: true,
        });
      }

      const center = await addCenter({
        serviceSlug,
        departmentId: department.id,
        type,
        name: nom,
        organizationName: organisation,
        discordRoleId: role ? role.id : null,
      });
      return interaction.reply({ embeds: [successEmbed("Centre ajouté", `**${center.name}** (${department.code} — ${department.name})`)], ephemeral: true });
    }

    if (sub === "centre-gerer") {
      const serviceSlug = interaction.options.getString("service", true);
      const centers = await listCentersForService(serviceSlug);
      if (centers.length === 0) {
        return interaction.reply({ embeds: [errorEmbed("Aucun centre", "Aucun centre configuré pour ce service. Utilise /departement centre-ajouter.")], ephemeral: true });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId("depcntmgr")
        .setPlaceholder("Choisissez un centre...")
        .addOptions(
          centers.slice(0, 25).map((c) => ({
            label: c.name,
            value: c.id,
            description: `${c.department ? c.department.code : "?"} — ${c.recruitment_open ? "ouvert" : "fermé"}${c.active ? "" : " (désactivé)"}`,
          }))
        );

      return interaction.reply({
        embeds: [baseEmbed().setTitle("Gestion des centres").setDescription("Choisissez le centre à ouvrir/fermer/activer/désactiver.")],
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
      });
    }

    if (sub === "liste") {
      const departments = await listAllDepartments();
      const lines = [];
      for (const service of SERVICES) {
        const centers = await listCentersForService(service.slug);
        if (centers.length === 0) continue;
        lines.push(
          `${service.emoji} **${service.label}**\n` +
            centers
              .map(
                (c) =>
                  `• ${c.name} (${c.department ? c.department.code : "?"}) — ${c.recruitment_open ? "🟢 ouvert" : "🔴 fermé"}${c.active ? "" : " · 🚫 désactivé"}`
              )
              .join("\n")
        );
      }

      return interaction.reply({
        embeds: [
          baseEmbed()
            .setTitle("Départements & centres configurés")
            .setDescription(
              `**Départements actifs :** ${departments.filter((d) => d.active).map((d) => d.code).join(", ") || "aucun"}\n\n${
                lines.join("\n\n") || "Aucun centre configuré."
              }`
            ),
        ],
        ephemeral: true,
      });
    }
  },
};
