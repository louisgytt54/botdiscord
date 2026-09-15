// ============================================================================
// interactions/applicationReview.js — traitement staff d'une candidature :
// Accepter (avec confirmation + verrou anti double-clic), Refuser (motif
// obligatoire), Demander des informations.
// ============================================================================

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { baseEmbed, successEmbed, errorEmbed } = require("../utils/embeds");
const { isRecruiter } = require("../services/permissions");
const {
  getApplication,
  acceptApplication,
  rejectApplication,
} = require("../services/applications");
const { getCenter, getDepartment, listServiceRows } = require("../services/supabase/catalog");
const { createOrActivateAssignment } = require("../services/assignments");
const { grantRoles } = require("../services/discordRoles");
const { recordAudit, logToDiscord } = require("../services/audit");

function denyIfNotRecruiter(interaction) {
  if (!isRecruiter(interaction.member)) {
    interaction.reply({ embeds: [errorEmbed("Permission refusée", "Seul le staff peut traiter les candidatures.")], ephemeral: true });
    return true;
  }
  return false;
}

async function loadContext(applicationId) {
  const application = await getApplication(applicationId);
  if (!application) return null;
  const center = await getCenter(application.operations_center_id);
  const department = center ? await getDepartment(center.department_id) : null;
  const services = await listServiceRows();
  const service = services.find((s) => s.id === application.service_id);
  return { application, center, department, service };
}

function markReviewedEmbed(originalEmbed, statusText, color, byUser) {
  const embed = baseEmbed()
    .setTitle(originalEmbed.title)
    .setDescription(originalEmbed.description)
    .addFields(originalEmbed.fields || [])
    .setColor(color)
    .setFooter({ text: `${statusText} par ${byUser.tag}` });
  return embed;
}

// ---------------------------------------------------------------------
// Accepter (demande de confirmation d'abord — section 10)
// ---------------------------------------------------------------------
async function handleAcceptButton(interaction, applicationId) {
  if (denyIfNotRecruiter(interaction)) return;

  // loadContext() fait plusieurs allers-retours Supabase : on défère avant
  // pour ne pas risquer un "Unknown interaction" (10062). Voir commands/membre.js.
  await interaction.deferReply({ ephemeral: true });

  const ctx = await loadContext(applicationId);
  if (!ctx || !ctx.application) {
    return interaction.editReply({ embeds: [errorEmbed("Introuvable", "Cette candidature n'existe plus.")] });
  }
  if (ctx.application.status !== "pending") {
    return interaction.editReply({ embeds: [errorEmbed("Déjà traitée", "Cette candidature a déjà été traitée par quelqu'un d'autre.")] });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`appaccok:${applicationId}`).setLabel("Confirmer l'acceptation").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`appaccno:${applicationId}`).setLabel("Annuler").setStyle(ButtonStyle.Secondary)
  );
  await interaction.editReply({
    embeds: [baseEmbed().setTitle("Confirmer l'acceptation ?").setDescription(`Candidat : <@${ctx.application.discord_user_id}>\nCentre : **${ctx.center ? ctx.center.name : "?"}**`)],
    components: [row],
  });
}

async function handleAcceptCancel(interaction) {
  await interaction.update({ embeds: [errorEmbed("Annulé", "Aucune action effectuée.")], components: [] });
}

async function handleAcceptConfirm(interaction, applicationId) {
  if (denyIfNotRecruiter(interaction)) return;

  // Ce traitement enchaîne de nombreux appels Supabase/Discord (acceptation,
  // affectation, rôles, audit, DM au candidat...) avant de répondre : on
  // défère IMMÉDIATEMENT (voir commands/membre.js) pour ne jamais dépasser
  // la fenêtre de 3s de Discord et provoquer un "Unknown interaction" (10062).
  await interaction.deferUpdate();

  // Verrou anti double-validation (section 18) : l'update conditionnel
  // (WHERE status = 'pending') ne réussit qu'une seule fois.
  const updated = await acceptApplication(applicationId, interaction.user.id);
  if (!updated) {
    return interaction.editReply({ embeds: [errorEmbed("Déjà traitée", "Cette candidature vient d'être traitée par quelqu'un d'autre.")], components: [] });
  }

  const ctx = await loadContext(applicationId);
  const { center, department, service } = ctx;

  const assignment = await createOrActivateAssignment({
    profileId: updated.user_id,
    serviceId: updated.service_id,
    departmentId: center.department_id,
    centerId: center.id,
    assignedByDiscordId: interaction.user.id,
  });

  await grantRoles(interaction.guild, updated.discord_user_id, service, center);

  await recordAudit({
    assignmentId: assignment.id,
    userId: updated.user_id,
    serviceId: updated.service_id,
    action: "assignment_activated",
    actorDiscordId: interaction.user.id,
    details: { application_id: applicationId, center_id: center.id },
  });

  await logToDiscord(interaction.guild, "✅ Candidature acceptée", {
    Candidat: `<@${updated.discord_user_id}>`,
    Service: service ? service.label : "?",
    Centre: center.name,
    Département: department ? `${department.code} — ${department.name}` : "?",
    "Traitée par": interaction.user.tag,
  });

  // Mise à jour de la fiche publique dans le salon de recrutement.
  const original = interaction.message.embeds[0];
  await interaction.message
    .edit({ embeds: [markReviewedEmbed(original, "✅ Acceptée", 0x2ecc71, interaction.user)], components: [] })
    .catch(() => {});

  const member = await interaction.guild.members.fetch(updated.discord_user_id).catch(() => null);
  if (member) {
    member
      .send({
        embeds: [
          successEmbed(
            "CANDIDATURE ACCEPTÉE",
            [
              "Félicitations ! Votre candidature a été acceptée.",
              "",
              `${service ? service.emoji : ""} Service :\n**${service ? service.label : "?"}**`,
              "",
              `🏥 Affectation :\n**${center.name}**`,
              "",
              `📍 Département :\n**${department ? `${department.code} — ${department.name}` : "?"}**`,
              "",
              "Votre accès au centre opérationnel est désormais actif. Vous pouvez vous connecter au jeu avec votre compte Discord et prendre votre service.",
            ].join("\n")
          ),
        ],
      })
      .catch(() => {});
  }

  await interaction.editReply({ embeds: [successEmbed("Candidature acceptée", "L'affectation a été créée et les rôles attribués.")], components: [] });
}

// ---------------------------------------------------------------------
// Refuser (motif obligatoire — section 13)
// ---------------------------------------------------------------------
async function handleRejectButton(interaction, applicationId) {
  if (denyIfNotRecruiter(interaction)) return;

  // showModal() doit être la toute première réponse à l'interaction (il est
  // impossible de deferReply() puis showModal()) : on limite donc au strict
  // nécessaire l'appel avant modal — un seul getApplication(), plutôt que le
  // loadContext() complet (qui va chercher aussi le centre/département/
  // services dont on n'a pas besoin ici) — pour minimiser le risque de
  // dépasser la fenêtre de 3s de Discord.
  const application = await getApplication(applicationId);
  if (!application || application.status !== "pending") {
    return interaction.reply({ embeds: [errorEmbed("Indisponible", "Cette candidature a déjà été traitée.")], ephemeral: true });
  }

  const modal = new ModalBuilder().setCustomId(`apprejm:${applicationId}`).setTitle("Motif du refus");
  const reason = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("Motif du refus")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);
  modal.addComponents(new ActionRowBuilder().addComponents(reason));
  await interaction.showModal(modal);
}

async function handleRejectModalSubmit(interaction, applicationId) {
  // Plusieurs appels Supabase/Discord suivent avant la réponse : on défère
  // tout de suite (voir commands/membre.js).
  await interaction.deferReply({ ephemeral: true });

  const reason = interaction.fields.getTextInputValue("reason");

  const updated = await rejectApplication(applicationId, interaction.user.id, reason);
  if (!updated) {
    return interaction.editReply({ embeds: [errorEmbed("Déjà traitée", "Cette candidature vient d'être traitée par quelqu'un d'autre.")] });
  }

  const ctx = await loadContext(applicationId);
  const { center, department, service } = ctx;

  await recordAudit({
    userId: updated.user_id,
    serviceId: updated.service_id,
    action: "application_rejected",
    actorDiscordId: interaction.user.id,
    details: { application_id: applicationId, reason },
  });

  await logToDiscord(interaction.guild, "❌ Candidature refusée", {
    Candidat: `<@${updated.discord_user_id}>`,
    Service: service ? service.label : "?",
    Motif: reason,
    "Traitée par": interaction.user.tag,
  });

  const original = interaction.message.embeds[0];
  await interaction.message
    .edit({ embeds: [markReviewedEmbed(original, "❌ Refusée", 0xe74c3c, interaction.user)], components: [] })
    .catch(() => {});

  const member = await interaction.guild.members.fetch(updated.discord_user_id).catch(() => null);
  if (member) {
    member
      .send({ embeds: [errorEmbed("Candidature refusée", `Votre candidature pour **${service ? service.label : "ce service"}${center ? ` — ${center.name}` : ""}** a été refusée.\n\nMotif : ${reason}`)] })
      .catch(() => {});
  }

  await interaction.editReply({ embeds: [successEmbed("Candidature refusée", "Le candidat a été notifié.")] });
}

// ---------------------------------------------------------------------
// Demander des informations
// ---------------------------------------------------------------------
async function handleInfoButton(interaction, applicationId) {
  if (denyIfNotRecruiter(interaction)) return;

  const modal = new ModalBuilder().setCustomId(`appinfom:${applicationId}`).setTitle("Demander des informations");
  const message = new TextInputBuilder()
    .setCustomId("message")
    .setLabel("Message à envoyer au candidat")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);
  modal.addComponents(new ActionRowBuilder().addComponents(message));
  await interaction.showModal(modal);
}

async function handleInfoModalSubmit(interaction, applicationId) {
  // Voir commands/membre.js : on défère avant le premier appel Supabase.
  await interaction.deferReply({ ephemeral: true });

  const message = interaction.fields.getTextInputValue("message");
  const ctx = await loadContext(applicationId);
  if (!ctx || !ctx.application) {
    return interaction.editReply({ embeds: [errorEmbed("Introuvable", "Cette candidature n'existe plus.")] });
  }

  await recordAudit({
    userId: ctx.application.user_id,
    serviceId: ctx.application.service_id,
    action: "info_requested",
    actorDiscordId: interaction.user.id,
    details: { application_id: applicationId, message },
  });

  const member = await interaction.guild.members.fetch(ctx.application.discord_user_id).catch(() => null);
  if (member) {
    member
      .send({ embeds: [baseEmbed().setTitle("💬 Demande d'informations sur votre candidature").setDescription(`${message}\n\n(Référence candidature : \`${ctx.application.reference_code}\`)`)] })
      .catch(() => {});
  }

  await interaction.editReply({ embeds: [successEmbed("Message envoyé", "Le candidat a reçu ta demande d'informations par message privé.")] });
}

module.exports = {
  handleAcceptButton,
  handleAcceptCancel,
  handleAcceptConfirm,
  handleRejectButton,
  handleRejectModalSubmit,
  handleInfoButton,
  handleInfoModalSubmit,
};
