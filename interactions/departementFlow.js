// ============================================================================
// interactions/departementFlow.js — sélection d'un centre à gérer (bascule
// recrutement ouvert/fermé, actif/inactif) depuis /departement centre-gerer.
//
// Comme pour commands/membre.js, on défère IMMÉDIATEMENT (avant le moindre
// appel Supabase) pour ne jamais dépasser la fenêtre de 3s de Discord et
// provoquer un "Unknown interaction" (10062). Les menus/select utilisent
// deferReply (nouvelle réponse éphémère), les boutons utilisent deferUpdate
// (on édite le message existant) ; dans les deux cas on finit par editReply().
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

function buildCenterCard(center) {
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

  return { embeds: [embed], components: [row] };
}

async function handleCenterManageSelect(interaction) {
  if (denyIfNotRecruiter(interaction)) return;
  await interaction.deferReply({ ephemeral: true });

  const centerId = interaction.values[0];
  const center = await getCenter(centerId);
  await interaction.editReply(buildCenterCard(center));
}

async function handleToggleRecruitment(interaction, centerId, open) {
  if (denyIfNotRecruiter(interaction)) return;
  await interaction.deferUpdate();

  await setCenterRecruitment(centerId, open);
  const center = await getCenter(centerId);
  await logToDiscord(interaction.guild, open ? "🟢 Recrutement ouvert" : "🔴 Recrutement fermé", { Centre: center.name, Par: interaction.user.tag });
  await interaction.editReply(buildCenterCard(center));
}

async function handleToggleActive(interaction, centerId, active) {
  if (denyIfNotRecruiter(interaction)) return;
  await interaction.deferUpdate();

  await setCenterActive(centerId, active);
  const center = await getCenter(centerId);
  await logToDiscord(interaction.guild, active ? "✅ Centre activé" : "🚫 Centre désactivé", { Centre: center.name, Par: interaction.user.tag });
  await interaction.editReply(buildCenterCard(center));
}

module.exports = { handleCenterManageSelect, handleToggleRecruitment, handleToggleActive };
