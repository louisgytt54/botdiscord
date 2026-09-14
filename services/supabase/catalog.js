// ============================================================================
// services/supabase/catalog.js — accès aux données "catalogue" (services,
// départements, centres opérationnels) stockées dans Supabase.
//
// Rien n'est codé en dur ici : ouvrir un département, ajouter/désactiver un
// centre, ouvrir/fermer un recrutement se fait uniquement en modifiant les
// lignes en base (via les commandes admin /departement), jamais dans le code.
// ============================================================================

const { getSupabase } = require("./client");
const { SERVICES } = require("../../config/services");

const CACHE_TTL_MS = 15_000;
const cache = { at: 0, services: null, departments: null, centers: null };

async function refreshCache() {
  const supabase = getSupabase();
  if (!supabase) return { services: [], departments: [], centers: [] };

  const now = Date.now();
  if (cache.at && now - cache.at < CACHE_TTL_MS) {
    return { services: cache.services, departments: cache.departments, centers: cache.centers };
  }

  const [servicesRes, departmentsRes, centersRes] = await Promise.all([
    supabase.from("services").select("id, slug, code, name, active"),
    supabase.from("departments").select("id, code, name, active").order("code"),
    supabase
      .from("operations_centers")
      .select(
        "id, service_id, department_id, type, name, organization_name, recruitment_open, active, discord_role_id"
      ),
  ]);

  // Ne JAMAIS avaler une erreur Supabase silencieusement : sans ce log, une
  // colonne manquante ou une table mal configurée donnerait juste "aucun
  // centre configuré" sans dire pourquoi, ce qui est très trompeur à déboguer.
  if (servicesRes.error) console.error("[catalog] Erreur chargement services :", servicesRes.error.message);
  if (departmentsRes.error) console.error("[catalog] Erreur chargement departments :", departmentsRes.error.message);
  if (centersRes.error) console.error("[catalog] Erreur chargement operations_centers :", centersRes.error.message);

  cache.at = now;
  cache.services = servicesRes.data || [];
  cache.departments = departmentsRes.data || [];
  cache.centers = centersRes.data || [];
  return { services: cache.services, departments: cache.departments, centers: cache.centers };
}

/** Force le prochain appel à recharger depuis Supabase (après une écriture admin). */
function invalidateCache() {
  cache.at = 0;
}

/** Ligne Supabase du service (jointe avec la définition statique du registre). */
async function getServiceRow(slug) {
  const { services } = await refreshCache();
  const row = services.find((s) => s.slug === slug);
  if (!row) return null;
  const def = SERVICES.find((s) => s.slug === slug) || {};
  return { ...def, ...row };
}

async function listServiceRows() {
  const { services } = await refreshCache();
  return SERVICES.map((def) => {
    const row = services.find((s) => s.slug === def.slug);
    return row ? { ...def, ...row } : null;
  }).filter(Boolean);
}

async function getDepartment(departmentId) {
  const { departments } = await refreshCache();
  return departments.find((d) => d.id === departmentId) || null;
}

async function listAllDepartments() {
  const { departments } = await refreshCache();
  return departments;
}

async function getCenter(centerId) {
  const { centers } = await refreshCache();
  return centers.find((c) => c.id === centerId) || null;
}

/** Centres (ouverts ou non) d'un service pour l'administration. */
async function listCentersForService(serviceSlug) {
  const { centers } = await refreshCache();
  const service = await getServiceRow(serviceSlug);
  if (!service) return [];
  const { departments } = await refreshCache();
  return centers
    .filter((c) => c.service_id === service.id)
    .map((c) => ({ ...c, department: departments.find((d) => d.id === c.department_id) || null }));
}

/**
 * Départements où AU MOINS un centre actif + recrutement ouvert existe pour
 * ce service. C'est ce qui détermine si un département est proposé à un
 * candidat pour ce service précis (ex : pas de CRRA disponible => le
 * département n'apparaît pas pour une candidature SAMU).
 */
async function listOpenDepartmentsForService(serviceSlug) {
  const service = await getServiceRow(serviceSlug);
  if (!service) return [];
  const { centers, departments } = await refreshCache();
  const openDeptIds = new Set(
    centers
      .filter((c) => c.service_id === service.id && c.active && c.recruitment_open)
      .map((c) => c.department_id)
  );
  return departments.filter((d) => d.active && openDeptIds.has(d.id));
}

/**
 * Centres actifs d'un service pour un département, SANS filtrer sur
 * recruitment_open — utilisé pour l'affectation manuelle par le staff
 * (/membre affecter), qui doit pouvoir placer un joueur même si le
 * recrutement public est fermé pour ce centre.
 */
async function listActiveCentersForServiceDepartment(serviceSlug, departmentId) {
  const service = await getServiceRow(serviceSlug);
  if (!service) return [];
  const { centers } = await refreshCache();
  return centers.filter((c) => c.service_id === service.id && c.department_id === departmentId && c.active);
}

/** Centres ouverts d'un service, pour un département donné. */
async function listOpenCentersForServiceDepartment(serviceSlug, departmentId) {
  const service = await getServiceRow(serviceSlug);
  if (!service) return [];
  const { centers } = await refreshCache();
  return centers.filter(
    (c) =>
      c.service_id === service.id &&
      c.department_id === departmentId &&
      c.active &&
      c.recruitment_open
  );
}

// ---------------------------------------------------------------------
// Écritures admin (invalident le cache pour être visibles immédiatement)
// ---------------------------------------------------------------------

async function addDepartment({ code, name }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("departments")
    .insert({ code, name })
    .select()
    .single();
  invalidateCache();
  if (error) throw error;
  return data;
}

async function addCenter({ serviceSlug, departmentId, type, name, organizationName, discordRoleId }) {
  const supabase = getSupabase();
  const service = await getServiceRow(serviceSlug);
  if (!service) throw new Error(`Service inconnu : ${serviceSlug}`);
  const { data, error } = await supabase
    .from("operations_centers")
    .insert({
      service_id: service.id,
      department_id: departmentId,
      type,
      name,
      organization_name: organizationName || null,
      discord_role_id: discordRoleId || null,
    })
    .select()
    .single();
  invalidateCache();
  if (error) throw error;
  return data;
}

async function setCenterRecruitment(centerId, open) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("operations_centers")
    .update({ recruitment_open: open })
    .eq("id", centerId);
  invalidateCache();
  if (error) throw error;
}

async function setCenterActive(centerId, active) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("operations_centers")
    .update({ active })
    .eq("id", centerId);
  invalidateCache();
  if (error) throw error;
}

module.exports = {
  getServiceRow,
  listServiceRows,
  getDepartment,
  listAllDepartments,
  getCenter,
  listCentersForService,
  listOpenDepartmentsForService,
  listOpenCentersForServiceDepartment,
  listActiveCentersForServiceDepartment,
  addDepartment,
  addCenter,
  setCenterRecruitment,
  setCenterActive,
  invalidateCache,
};
