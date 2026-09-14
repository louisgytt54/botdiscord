// ============================================================================
// interactions/departementFlow.js — sélection d'un centre à gérer (bascule
// recrutement ouvert/fermé, actif/inactif) depuis /departement centre-gerer.
// ============================================================================

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { baseEmbed, successEmbed } = require("../utils/embeds");
const { isRecruiter } = require("../services/permissions");
const { getCenter, setCenterRecruitment, setCenterActive } = require("../services/supabase/catalog");
const { logToDiscord } = require("../services/audit");

function denyIfNotRecruiter(interaction) {
  if (!isRecruiter(interaction.member)) {
    interaction.reply({ content: "Réservé au staff.", ephemeral: true });
    return true;
  }
  return false;
}

async function renderCenterCard(interaction, centerId, isUpdate) {
  const center = await getCenter(centerId);
  const embed = baseEmbed()
    .setTitle(center.name)
    .setDescription(
      [
        center.organization_name || null,
        `Recrutement : ${center.recruitment_open ? "🟢 ouvert" : "🔴 fermé"}`,
        `Centre : ${center.active ? "✅ actif" : "🚫 désactivé"}`,
      ]
        .filter(Boolean)
        .join("\n")
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(center.recruitment_open ? `depclose:${center.id}` : `depopen:${center.id}`)
      .setLabel(center.recruitment_open ? "Fermer le recrutement" : "Ouvrir le recrutement")
      .setStyle(center.recruitment_open ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(center.active ? `depdeact:${center.id}` : `depact:${center.id}`)
      .setLabel(center.active ? "Désactiver le centre" : "Activer le centre")
      .setStyle(ButtonStyle.Secondary)
  );

  const payload = { embeds: [embed], components: [row] };
  if (isUpdate) await interaction.update(payload);
  else await interaction.reply({ ...payload, ephemeral: true });
}

async function handleCenterManageSelect(interaction) {
  if (denyIfNotRecruiter(interaction)) return;
  await renderCenterCard(interaction, interaction.values[0], false);
}

async function handleToggleRecruitment(interaction, centerId, open) {
  if (denyIfNotRecruiter(interaction)) return;
  await setCenterRecruitment(centerId, open);
  await logToDiscord(interaction.guild, open ? "🟢 Recrutement ouvert" : "🔴 Recrutement fermé", { Centre: (await getCenter(centerId)).name, Par: interaction.user.tag });
  await renderCenterCard(interaction, centerId, true);
}

async function handleToggleActive(interaction, centerId, active) {
  if (denyIfNotRecruiter(interaction)) return;
  await setCenterActive(centerId, active);
  await logToDiscord(interaction.guild, active ? "✅ Centre activé" : "🚫 Centre désactivé", { Centre: (await getCenter(centerId)).name, Par: interaction.user.tag });
  await renderCenterCard(interaction, centerId, true);
}

module.exports = { handleCenterManageSelect, handleToggleRecruitment, handleToggleActive };
