// ============================================================================
// interactions/membreFlow.js — gestion manuelle des affectations par le staff
// (/membre affecter|suspendre|reactiver|retirer). Même logique métier que le
// parcours de candidature (services/assignments.js), mais sans passer par une
// candidature : le staff choisit directement service -> département -> centre.
// ============================================================================

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { baseEmbed, successEmbed, errorEmbed } = require("../utils/embeds");
const { isRecruiter } = require("../services/permissions");
const {
  listAllDepartments,
  listActiveCentersForServiceDepartment,
  getServiceRow,
  getDepartment,
  getCenter,
  listServiceRows,
} = require("../services/supabase/catalog");
const { getProfileByDiscordId } = require("../services/supabase/profiles");
const {
  createOrActivateAssignment,
  getAssignment,
  listAssignmentsForProfile,
  listActiveAssignmentsForService,
  suspendAssignment,
  reactivateAssignment,
  revokeAssignment,
} = require("../services/assignments");
const { grantRoles, revokeRoles } = require("../services/discordRoles");
const { recordAudit, logToDiscord } = require("../services/audit");

function denyIfNotRecruiter(interaction) {
  if (!isRecruiter(interaction.member)) {
    interaction.reply({ embeds: [errorEmbed("Permission refusée", "Réservé au staff.")], ephemeral: true });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// /membre affecter — service -> département -> centre -> affectation directe
// ---------------------------------------------------------------------
async function handleAssignServiceSelect(interaction, targetId) {
  if (denyIfNotRecruiter(interaction)) return;
  // Voir commands/membre.js : on défère avant tout appel Supabase. Ici la
  // réponse édite le message existant (menu précédent) -> deferUpdate().
  await interaction.deferUpdate();

  const serviceSlug = interaction.values[0];
  const service = await getServiceRow(serviceSlug);
  const allDepartments = (await listAllDepartments()).filter((d) => d.active);

  if (allDepartments.length === 0) {
    return interaction.editReply({ embeds: [errorEmbed("Aucun département", "Aucun département actif n'est configuré.")], components: [] });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`madep:${targetId}:${serviceSlug}`)
    .setPlaceholder("Choisissez un département...")
    .addOptions(allDepartments.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.id })));

  await interaction.editReply({
    embeds: [baseEmbed().setTitle(`${service.emoji} ${service.label}`).setDescription("📍 Choisissez le département de l'affectation.")],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

async function handleAssignDepartmentSelect(interaction, targetId, serviceSlug) {
  if (denyIfNotRecruiter(interaction)) return;
  await interaction.deferUpdate();

  const departmentId = interaction.values[0];
  const service = await getServiceRow(serviceSlug);
  const department = await getDepartment(departmentId);
  const centers = await listActiveCentersForServiceDepartment(serviceSlug, departmentId);

  if (centers.length === 0) {
    return interaction.editReply({ embeds: [errorEmbed("Aucun centre", `Aucun centre actif pour **${service.label}** dans ce département. Crée-en un avec /departement centre-ajouter.`)], components: [] });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`macnt:${targetId}:${serviceSlug}:${departmentId}`)
    .setPlaceholder("Choisissez un centre...")
    .addOptions(centers.map((c) => ({ label: c.name, value: c.id, description: c.organization_name || undefined })));

  await interaction.editReply({
    embeds: [baseEmbed().setTitle(`${service.emoji} ${service.label}`).setDescription(`📍 Département : **${department.code} — ${department.name}**\n\nChoisissez le centre.`)],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

async function handleAssignCenterSelect(interaction, targetId, serviceSlug, departmentId) {
  if (denyIfNotRecruiter(interaction)) return;
  await interaction.deferUpdate();

  const centerId = interaction.values[0];
  const center = await getCenter(centerId);
  const department = await getDepartment(departmentId);
  const service = await getServiceRow(serviceSlug);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`maconf:${targetId}:${centerId}`).setLabel("Confirmer l'affectation").setStyle(ButtonStyle.Success)
  );

  await interaction.editReply({
    embeds: [
      baseEmbed()
        .setTitle("Confirmer l'affectation ?")
        .setDescription(`Membre : <@${targetId}>\nService : **${service.label}**\nCentre : **${center.name}**\nDépartement : **${department.code} — ${department.name}**`),
    ],
    components: [row],
  });
}

async function handleAssignConfirm(interaction, targetId, centerId) {
  if (denyIfNotRecruiter(interaction)) return;
  // Enchaîne affectation + rôles Discord + audit : on défère tout de suite.
  await interaction.deferUpdate();

  const profile = await getProfileByDiscordId(targetId);
  if (!profile) {
    return interaction.editReply({ embeds: [errorEmbed("Compte jeu introuvable", "Ce membre ne s'est jamais connecté au jeu avec Discord — impossible de l'affecter.")], components: [] });
  }

  const center = await getCenter(centerId);
  const department = await getDepartment(center.department_id);
  const services = await listServiceRows();
  const service = services.find((s) => s.id === center.service_id);

  const assignment = await createOrActivateAssignment({
    profileId: profile.id,
    serviceId: center.service_id,
    departmentId: center.department_id,
    centerId: center.id,
    assignedByDiscordId: interaction.user.id,
  });

  await grantRoles(interaction.guild, targetId, service, center);

  await recordAudit({
    assignmentId: assignment.id,
    userId: profile.id,
    serviceId: center.service_id,
    action: "manual_assignment",
    actorDiscordId: interaction.user.id,
    details: { center_id: center.id },
  });
  await logToDiscord(interaction.guild, "🛠️ Affectation manuelle", {
    Membre: `<@${targetId}>`,
    Service: service.label,
    Centre: center.name,
    Département: `${department.code} — ${department.name}`,
    "Par": interaction.user.tag,
  });

  await interaction.editReply({ embeds: [successEmbed("Affectation créée", `<@${targetId}> est maintenant affecté à **${center.name}**.`)], components: [] });
}

// ---------------------------------------------------------------------
// /membre suspendre — sélection de l'affectation active -> motif -> suspension
// ---------------------------------------------------------------------
async function handleSuspendSelect(interaction, targetId) {
  if (denyIfNotRecruiter(interaction)) return;
  const assignmentId = interaction.values[0];

  const modal = new ModalBuilder().setCustomId(`masuspm:${assignmentId}`).setTitle("Motif de la suspension");
  const reason = new TextInputBuilder().setCustomId("reason").setLabel("Raison").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
  modal.addComponents(new ActionRowBuilder().addComponents(reason));
  await interaction.showModal(modal);
}

async function handleSuspendModalSubmit(interaction, assignmentId) {
  // Voir commands/membre.js : plusieurs appels Supabase/Discord suivent
  // avant la réponse, on défère tout de suite.
  await interaction.deferReply({ ephemeral: true });

  const reason = interaction.fields.getTextInputValue("reason");
  const assignment = await getAssignment(assignmentId);
  if (!assignment || assignment.status !== "active") {
    return interaction.editReply({ embeds: [errorEmbed("Indisponible", "Cette affectation n'est plus active.")] });
  }

  const updated = await suspendAssignment(assignmentId, interaction.user.id, reason);
  const center = await getCenter(updated.operations_center_id);
  const services = await listServiceRows();
  const service = services.find((s) => s.id === updated.service_id);

  // Ne retire le rôle général du service que si plus AUCUNE autre
  // affectation active de ce service ne subsiste (section 14 : une
  // suspension sur un centre ne doit pas affecter les autres).
  const remaining = await listActiveAssignmentsForService(updated.user_id, updated.service_id, assignmentId);
  await revokeRoles(interaction.guild, assignment.discord_user_id || (await profileDiscordId(updated.user_id)), service, center, remaining.length === 0);

  await recordAudit({
    assignmentId,
    userId: updated.user_id,
    serviceId: updated.service_id,
    action: "assignment_suspended",
    actorDiscordId: interaction.user.id,
    details: { reason },
  });
  await logToDiscord(interaction.guild, "⏸️ Affectation suspendue", { Centre: center ? center.name : "?", Motif: reason, Par: interaction.user.tag });

  await interaction.editReply({ embeds: [successEmbed("Affectation suspendue", "L'accès à ce centre est désormais suspendu.")] });
}

// ---------------------------------------------------------------------
// /membre reactiver
// ---------------------------------------------------------------------
async function handleReactivateSelect(interaction, targetId) {
  if (denyIfNotRecruiter(interaction)) return;
  const assignmentId = interaction.values[0];
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mareactok:${assignmentId}`).setLabel("Confirmer la réactivation").setStyle(ButtonStyle.Success)
  );
  await interaction.update({ embeds: [baseEmbed().setTitle("Confirmer la réactivation ?").setDescription(`<@${targetId}>`)], components: [row] });
}

async function handleReactivateConfirm(interaction, assignmentId) {
  if (denyIfNotRecruiter(interaction)) return;
  // Voir commands/membre.js : plusieurs appels Supabase/Discord suivent.
  await interaction.deferUpdate();

  const before = await getAssignment(assignmentId);
  if (!before || before.status !== "suspended") {
    return interaction.editReply({ embeds: [errorEmbed("Indisponible", "Cette affectation n'est pas suspendue.")], components: [] });
  }

  const updated = await reactivateAssignment(assignmentId, interaction.user.id);
  const center = await getCenter(updated.operations_center_id);
  const services = await listServiceRows();
  const service = services.find((s) => s.id === updated.service_id);
  const discordId = await profileDiscordId(updated.user_id);
  await grantRoles(interaction.guild, discordId, service, center);

  await recordAudit({ assignmentId, userId: updated.user_id, serviceId: updated.service_id, action: "assignment_reactivated", actorDiscordId: interaction.user.id });
  await logToDiscord(interaction.guild, "▶️ Affectation réactivée", { Centre: center ? center.name : "?", Par: interaction.user.tag });

  await interaction.editReply({ embeds: [successEmbed("Affectation réactivée", "L'accès à ce centre est de nouveau actif.")], components: [] });
}

// ---------------------------------------------------------------------
// /membre retirer
// ---------------------------------------------------------------------
async function handleRevokeSelect(interaction, targetId) {
  if (denyIfNotRecruiter(interaction)) return;
  const assignmentId = interaction.values[0];
  const modal = new ModalBuilder().setCustomId(`maretm:${assignmentId}`).setTitle("Motif du retrait");
  const reason = new TextInputBuilder().setCustomId("reason").setLabel("Raison").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
  modal.addComponents(new ActionRowBuilder().addComponents(reason));
  await interaction.showModal(modal);
}

async function handleRevokeModalSubmit(interaction, assignmentId) {
  // Voir commands/membre.js : plusieurs appels Supabase/Discord suivent.
  await interaction.deferReply({ ephemeral: true });

  const reason = interaction.fields.getTextInputValue("reason");
  const before = await getAssignment(assignmentId);
  if (!before || before.status === "revoked") {
    return interaction.editReply({ embeds: [errorEmbed("Indisponible", "Cette affectation est déjà retirée.")] });
  }

  const updated = await revokeAssignment(assignmentId, interaction.user.id, reason);
  const center = await getCenter(updated.operations_center_id);
  const services = await listServiceRows();
  const service = services.find((s) => s.id === updated.service_id);
  const discordId = await profileDiscordId(updated.user_id);

  const remaining = await listActiveAssignmentsForService(updated.user_id, updated.service_id, assignmentId);
  await revokeRoles(interaction.guild, discordId, service, center, remaining.length === 0);

  await recordAudit({ assignmentId, userId: updated.user_id, serviceId: updated.service_id, action: "assignment_revoked", actorDiscordId: interaction.user.id, details: { reason } });
  await logToDiscord(interaction.guild, "🗑️ Affectation retirée", { Centre: center ? center.name : "?", Motif: reason, Par: interaction.user.tag });

  await interaction.editReply({ embeds: [successEmbed("Affectation retirée", "L'accès à ce centre a été retiré.")] });
}

// ---------------------------------------------------------------------
// Helper : retrouver l'ID Discord depuis un profil (uuid) — les tables
// d'affectation ne stockent que l'uuid ; le lien inverse passe par profiles.
// ---------------------------------------------------------------------
async function profileDiscordId(profileId) {
  const { getSupabase } = require("../services/supabase/client");
  const supabase = getSupabase();
  const { data, error } = await supabase.from("profiles").select("discord_id").eq("id", profileId).maybeSingle();
  if (error) {
    console.error("[membreFlow] Erreur profileDiscordId :", error.message);
    return null;
  }
  return data ? data.discord_id : null;
}

module.exports = {
  handleAssignServiceSelect,
  handleAssignDepartmentSelect,
  handleAssignCenterSelect,
  handleAssignConfirm,
  handleSuspendSelect,
  handleSuspendModalSubmit,
  handleReactivateSelect,
  handleReactivateConfirm,
  handleRevokeSelect,
  handleRevokeModalSubmit,
  listAssignmentsForProfile,
  getProfileByDiscordId,
};
