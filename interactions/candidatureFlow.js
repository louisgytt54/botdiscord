// ============================================================================
// interactions/candidatureFlow.js — parcours complet du candidat :
// service -> département -> centre -> confirmation -> formulaire -> envoi.
//
// Le panneau posté par /candidature panneau est un message PARTAGÉ par tout
// le serveur : chaque étape suivante répond donc en message ÉPHÉMÈRE propre
// au candidat (jamais interaction.update() sur le panneau lui-même), pour ne
// jamais perturber les autres membres qui l'utilisent en même temps.
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
const config = require("../config");
const { getQuestions } = require("../config/services");
const { baseEmbed, errorEmbed, successEmbed } = require("../utils/embeds");
const { findChannel } = require("../utils/resolve");
const {
  getServiceRow,
  listOpenDepartmentsForService,
  listOpenCentersForServiceDepartment,
  getDepartment,
  getCenter,
} = require("../services/supabase/catalog");
const { getProfileByDiscordId } = require("../services/supabase/profiles");
const { createApplication, ApplicationError } = require("../services/applications");
const { recordAudit, logToDiscord } = require("../services/audit");

const NO_PROFILE_MESSAGE =
  "Vous devez d'abord vous connecter au jeu avec votre compte Discord (au moins une fois) avant de pouvoir candidater. Rendez-vous sur le site du jeu, connectez-vous, puis revenez cliquer ici.";

// ---------------------------------------------------------------------
// Étape 1 : choix du service
// ---------------------------------------------------------------------
async function handleServiceSelect(interaction) {
  const serviceSlug = interaction.values[0];

  const profile = await getProfileByDiscordId(interaction.user.id);
  if (!profile) {
    return interaction.reply({ embeds: [errorEmbed("Compte jeu introuvable", NO_PROFILE_MESSAGE)], ephemeral: true });
  }

  const service = await getServiceRow(serviceSlug);
  if (!service) {
    return interaction.reply({ embeds: [errorEmbed("Service introuvable", "Ce service n'existe plus.")], ephemeral: true });
  }

  const departments = await listOpenDepartmentsForService(serviceSlug);
  if (departments.length === 0) {
    return interaction.reply({
      embeds: [
        errorEmbed(
          "Aucun recrutement ouvert",
          `Aucun département n'a de recrutement ouvert pour **${service.label}** actuellement. Réessaie plus tard.`
        ),
      ],
      ephemeral: true,
    });
  }

  const embed = baseEmbed()
    .setTitle(`${service.emoji} ${service.label}`)
    .setDescription(`📍 Choisissez votre département.\n\n${service.description || ""}`);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`cdep:${serviceSlug}`)
    .setPlaceholder("Choisissez un département...")
    .addOptions(departments.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.id })));

  await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
}

// ---------------------------------------------------------------------
// Étape 2 : choix du département -> centre (ou confirmation directe si un seul centre)
// ---------------------------------------------------------------------
async function handleDepartmentSelect(interaction, serviceSlug) {
  const departmentId = interaction.values[0];
  const service = await getServiceRow(serviceSlug);
  const department = await getDepartment(departmentId);
  const centers = await listOpenCentersForServiceDepartment(serviceSlug, departmentId);

  if (centers.length === 0) {
    return interaction.update({
      embeds: [errorEmbed("Aucun centre disponible", "Le recrutement vient de se fermer pour ce département. Réessaie plus tard.")],
      components: [],
    });
  }

  if (centers.length === 1) {
    return showConfirmation(interaction, service, department, centers[0]);
  }

  const embed = baseEmbed()
    .setTitle(`${service.emoji} ${service.label}`)
    .setDescription(`📍 Département : **${department.code} — ${department.name}**\n\nPlusieurs centres sont disponibles, choisissez le vôtre.`);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`ccnt:${serviceSlug}:${departmentId}`)
    .setPlaceholder("Choisissez un centre...")
    .addOptions(
      centers.map((c) => ({
        label: c.name,
        value: c.id,
        description: c.organization_name ? c.organization_name.slice(0, 100) : undefined,
      }))
    );

  await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

// ---------------------------------------------------------------------
// Étape 3 : choix du centre (quand il y en a plusieurs) -> confirmation
// ---------------------------------------------------------------------
async function handleCenterSelect(interaction, serviceSlug, departmentId) {
  const centerId = interaction.values[0];
  const service = await getServiceRow(serviceSlug);
  const department = await getDepartment(departmentId);
  const center = await getCenter(centerId);
  await showConfirmation(interaction, service, department, center, true);
}

async function showConfirmation(interaction, service, department, center, isUpdate) {
  const embed = baseEmbed()
    .setColor(service.color || config.branding.color)
    .setTitle(`${service.emoji} ${service.label.toUpperCase()}`)
    .setDescription(
      [
        `**${center.name}**`,
        center.organization_name ? center.organization_name : null,
        "",
        service.description || "",
        "",
        `📍 Département :\n**${department.code} — ${department.name}**`,
        "",
        "🟢 Recrutement ouvert",
      ]
        .filter((l) => l !== null)
        .join("\n")
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cconf:${center.id}`).setLabel("Postuler").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ccancel").setLabel("Annuler").setStyle(ButtonStyle.Secondary)
  );

  const payload = { embeds: [embed], components: [row] };
  if (isUpdate) await interaction.update(payload);
  else await interaction.reply({ ...payload, ephemeral: true });
}

async function handleCancel(interaction) {
  await interaction.update({ embeds: [errorEmbed("Candidature annulée", "Vous pouvez recommencer à tout moment depuis le panneau.")], components: [] });
}

// ---------------------------------------------------------------------
// Étape 4 : bouton "Postuler" -> ouverture du formulaire (Modal)
// ---------------------------------------------------------------------
async function handleConfirmButton(interaction, centerId) {
  const center = await getCenter(centerId);
  if (!center || !center.active || !center.recruitment_open) {
    return interaction.update({ embeds: [errorEmbed("Recrutement fermé", "Ce centre n'accepte plus de candidatures pour le moment.")], components: [] });
  }

  const modal = buildApplicationModal(centerId);
  await interaction.showModal(modal);
}

function buildApplicationModal(centerId) {
  const questions = getQuestions();
  const modal = new ModalBuilder().setCustomId(`cmodal:${centerId}`).setTitle("Candidature");

  for (const q of questions) {
    const input = new TextInputBuilder()
      .setCustomId(q.id)
      .setLabel(q.label.slice(0, 45))
      .setStyle(q.style === "PARAGRAPH" ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(!!q.required)
      .setMaxLength(q.maxLength || 500);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return modal;
}

// ---------------------------------------------------------------------
// Étape 5 : soumission du formulaire -> enregistrement Supabase + fiche staff
// ---------------------------------------------------------------------
async function handleModalSubmit(interaction, centerId) {
  const profile = await getProfileByDiscordId(interaction.user.id);
  if (!profile) {
    return interaction.reply({ embeds: [errorEmbed("Compte jeu introuvable", NO_PROFILE_MESSAGE)], ephemeral: true });
  }

  const center = await getCenter(centerId);
  if (!center) {
    return interaction.reply({ embeds: [errorEmbed("Centre introuvable", "Ce centre opérationnel n'existe plus.")], ephemeral: true });
  }
  const department = await getDepartment(center.department_id);
  const services = require("../services/supabase/catalog");
  const allServices = await services.listServiceRows();
  const service = allServices.find((s) => s.id === center.service_id);

  const questions = getQuestions(service ? service.slug : undefined);
  const answers = {};
  for (const q of questions) {
    answers[q.id] = interaction.fields.getTextInputValue(q.id) || null;
  }

  let application;
  try {
    application = await createApplication({
      profileId: profile.id,
      serviceId: center.service_id,
      departmentId: center.department_id,
      centerId: center.id,
      discordUserId: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.member ? interaction.member.displayName : interaction.user.username,
      answers,
    });
  } catch (err) {
    if (err instanceof ApplicationError) {
      return interaction.reply({ embeds: [errorEmbed("Candidature impossible", err.message)], ephemeral: true });
    }
    console.error("[candidatureFlow] Erreur création candidature :", err);
    return interaction.reply({ embeds: [errorEmbed("Erreur", "Une erreur est survenue lors de l'enregistrement de ta candidature.")], ephemeral: true });
  }

  await recordAudit({
    userId: profile.id,
    serviceId: center.service_id,
    action: "application_submitted",
    actorDiscordId: interaction.user.id,
    details: { application_id: application.id, center_id: center.id, department_id: center.department_id },
  });

  await postStaffReview(interaction, { application, service, department, center, answers, questions });

  await interaction.reply({
    embeds: [
      successEmbed(
        "Candidature envoyée",
        `Ta candidature pour **${service ? service.label : "ce service"} — ${center.name}** a bien été transmise. Référence : \`${application.reference_code}\`. Tu recevras une réponse par message privé.`
      ),
    ],
    ephemeral: true,
  });
}

async function postStaffReview(interaction, { application, service, department, center, answers, questions }) {
  const channel = findChannel(interaction.guild, config.channels.candidatures);
  if (!channel || !channel.isTextBased()) return;

  const embed = baseEmbed()
    .setColor(service ? service.color : config.branding.color)
    .setTitle("📋 NOUVELLE CANDIDATURE")
    .addFields(
      { name: "👤 Candidat", value: `<@${interaction.user.id}>`, inline: true },
      { name: `${service ? service.emoji : ""} Service`, value: service ? service.label : "?", inline: true },
      { name: "🏥 Centre", value: center.name, inline: true },
      { name: "📍 Département", value: `${department.code} — ${department.name}`, inline: true },
      { name: "🕐 Candidature", value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
      { name: "🆔 Référence", value: application.reference_code, inline: true },
      ...questions.map((q) => ({ name: q.label, value: answers[q.id] || "—" }))
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`appacc:${application.id}`).setLabel("Accepter").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`apprej:${application.id}`).setLabel("Refuser").setEmoji("❌").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`appinfo:${application.id}`).setLabel("Demander des informations").setEmoji("💬").setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

module.exports = {
  handleServiceSelect,
  handleDepartmentSelect,
  handleCenterSelect,
  handleConfirmButton,
  handleCancel,
  handleModalSubmit,
};
