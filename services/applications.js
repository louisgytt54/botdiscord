// ============================================================================
// services/applications.js — cycle de vie d'une candidature :
// création (avec vérification des doublons), acceptation, refus.
// ============================================================================

const { getSupabase } = require("./supabase/client");

class ApplicationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Vérifie les doublons AVANT de créer une candidature (section 8 du cahier
 * des charges) : une candidature pending sur le même centre, ou une
 * affectation déjà active sur ce centre, bloquent une nouvelle candidature.
 * Une candidature refusée/retirée, ou une affectation suspendue/révoquée,
 * ne bloquent PAS une nouvelle tentative.
 */
async function assertNoDuplicate(profileId, centerId) {
  const supabase = getSupabase();

  const { data: pending } = await supabase
    .from("service_applications")
    .select("id")
    .eq("user_id", profileId)
    .eq("operations_center_id", centerId)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    throw new ApplicationError(
      "DUPLICATE_PENDING",
      "Vous possédez déjà une candidature en cours pour ce centre."
    );
  }

  const { data: active } = await supabase
    .from("user_service_assignments")
    .select("id")
    .eq("user_id", profileId)
    .eq("operations_center_id", centerId)
    .eq("status", "active")
    .maybeSingle();
  if (active) {
    throw new ApplicationError(
      "ALREADY_ASSIGNED",
      "Vous êtes déjà affecté à ce centre opérationnel."
    );
  }
}

/**
 * @param {object} params
 * @param {string} params.profileId uuid Supabase (profiles.id)
 * @param {string} params.serviceId uuid
 * @param {string} params.departmentId uuid
 * @param {string} params.centerId uuid
 * @param {string} params.discordUserId
 * @param {string} params.username
 * @param {string} params.displayName
 * @param {Record<string,string>} params.answers
 */
async function createApplication(params) {
  const supabase = getSupabase();
  if (!supabase) throw new ApplicationError("NO_DB", "Supabase n'est pas configuré sur ce bot.");

  await assertNoDuplicate(params.profileId, params.centerId);

  const { data, error } = await supabase
    .from("service_applications")
    .insert({
      user_id: params.profileId,
      service_id: params.serviceId,
      department_id: params.departmentId,
      operations_center_id: params.centerId,
      discord_user_id: params.discordUserId,
      username: params.username,
      display_name: params.displayName,
      answers: params.answers || {},
      status: "pending",
    })
    .select()
    .single();

  if (error) throw new ApplicationError("DB_ERROR", error.message);
  return data;
}

async function getApplication(applicationId) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("service_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  return data;
}

/**
 * Passe une candidature en "accepted" — de façon ATOMIQUE : la condition
 * .eq("status", "pending") dans le WHERE garantit qu'un seul clic gagne si
 * deux recruteurs valident en même temps (section 18 : éviter les doubles
 * validations).
 * @returns {Promise<object|null>} la ligne mise à jour, ou null si déjà traitée.
 */
async function acceptApplication(applicationId, decidedByDiscordId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("service_applications")
    .update({ status: "accepted", decided_at: new Date().toISOString(), decided_by: decidedByDiscordId })
    .eq("id", applicationId)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (error) throw new ApplicationError("DB_ERROR", error.message);
  return data;
}

async function rejectApplication(applicationId, decidedByDiscordId, reason) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("service_applications")
    .update({
      status: "rejected",
      decided_at: new Date().toISOString(),
      decided_by: decidedByDiscordId,
      rejection_reason: reason,
    })
    .eq("id", applicationId)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (error) throw new ApplicationError("DB_ERROR", error.message);
  return data;
}

module.exports = {
  ApplicationError,
  createApplication,
  getApplication,
  acceptApplication,
  rejectApplication,
};
