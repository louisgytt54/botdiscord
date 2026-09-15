// ============================================================================
// services/assignments.js — affectations d'un joueur à un centre opérationnel.
//
// Rappel important (section 11 du cahier des charges) : Supabase est la seule
// source de vérité pour l'accès au jeu. Les rôles Discord attribués par ce
// module ne sont qu'une REPRÉSENTATION communautaire de l'affectation, jamais
// une preuve d'autorisation en elle-même.
// ============================================================================

const { getSupabase } = require("./supabase/client");

/** Crée l'affectation si elle n'existe pas, ou la réactive si elle existe déjà
 * (pending/suspended/revoked -> active). Un centre = au plus une ligne par
 * joueur (contrainte unique user_id+operations_center_id).
 */
async function createOrActivateAssignment({ profileId, serviceId, departmentId, centerId, assignedByDiscordId }) {
  const supabase = getSupabase();

  const { data: existing, error: existingError } = await supabase
    .from("user_service_assignments")
    .select("id")
    .eq("user_id", profileId)
    .eq("operations_center_id", centerId)
    .maybeSingle();
  if (existingError) throw existingError;

  const payload = {
    user_id: profileId,
    service_id: serviceId,
    department_id: departmentId,
    operations_center_id: centerId,
    status: "active",
    assigned_by: assignedByDiscordId,
    assigned_at: new Date().toISOString(),
    revoked_at: null,
    revoked_reason: null,
    suspended_reason: null,
    suspended_by: null,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("user_service_assignments")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("user_service_assignments")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getAssignment(assignmentId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_service_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) {
    console.error("[assignments] Erreur getAssignment :", error.message);
    throw error;
  }
  return data;
}

async function listAssignmentsForProfile(profileId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_service_assignments")
    .select("*")
    .eq("user_id", profileId)
    .order("assigned_at", { ascending: false });
  if (error) {
    console.error("[assignments] Erreur listAssignmentsForProfile :", error.message);
    throw error;
  }
  return data || [];
}

/** Affectations actives d'un joueur pour un service donné (hors le centre exclu, si fourni). */
async function listActiveAssignmentsForService(profileId, serviceId, excludeAssignmentId) {
  const supabase = getSupabase();
  let query = supabase
    .from("user_service_assignments")
    .select("*")
    .eq("user_id", profileId)
    .eq("service_id", serviceId)
    .eq("status", "active");
  if (excludeAssignmentId) query = query.neq("id", excludeAssignmentId);
  const { data, error } = await query;
  if (error) {
    console.error("[assignments] Erreur listActiveAssignmentsForService :", error.message);
    throw error;
  }
  return data || [];
}

async function suspendAssignment(assignmentId, staffDiscordId, reason) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_service_assignments")
    .update({ status: "suspended", suspended_by: staffDiscordId, suspended_reason: reason })
    .eq("id", assignmentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function reactivateAssignment(assignmentId, staffDiscordId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_service_assignments")
    .update({
      status: "active",
      assigned_by: staffDiscordId,
      assigned_at: new Date().toISOString(),
      suspended_reason: null,
      suspended_by: null,
    })
    .eq("id", assignmentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function revokeAssignment(assignmentId, staffDiscordId, reason) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_service_assignments")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
      suspended_by: staffDiscordId,
    })
    .eq("id", assignmentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  createOrActivateAssignment,
  getAssignment,
  listAssignmentsForProfile,
  listActiveAssignmentsForService,
  suspendAssignment,
  reactivateAssignment,
  revokeAssignment,
};
