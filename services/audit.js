// ============================================================================
// services/audit.js — journal des candidatures/affectations, à la fois dans
// Supabase (access_audit_log, invisible au client — historique source de
// vérité) et dans le salon Discord #server-logs (visibilité humaine immédiate).
// ============================================================================

const { getSupabase } = require("./supabase/client");
const { baseEmbed } = require("../utils/embeds");
const { log } = require("../utils/logger");

/**
 * @param {object} entry
 * @param {string} [entry.assignmentId]
 * @param {string} [entry.userId] uuid Supabase (profiles.id), pas l'ID Discord
 * @param {string} [entry.serviceId]
 * @param {string} entry.action ex: "application_submitted", "assignment_activated", "assignment_suspended"...
 * @param {string} entry.actorDiscordId
 * @param {object} [entry.details]
 */
async function recordAudit(entry) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from("access_audit_log").insert({
      assignment_id: entry.assignmentId || null,
      user_id: entry.userId || null,
      service_id: entry.serviceId || null,
      action: entry.action,
      actor: entry.actorDiscordId || "system",
      details: entry.details || {},
    });
  } catch (err) {
    console.error("[audit] Échec de l'écriture Supabase :", err.message);
  }
}

/**
 * Log Discord lisible pour le staff, en plus de l'entrée Supabase.
 * @param {import('discord.js').Guild} guild
 * @param {string} title
 * @param {Record<string,string>} fields
 */
async function logToDiscord(guild, title, fields) {
  const embed = baseEmbed()
    .setTitle(title)
    .addFields(
      Object.entries(fields)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([name, value]) => ({ name, value: String(value), inline: true }))
    );
  await log(guild, "server", embed);
}

module.exports = { recordAudit, logToDiscord };
