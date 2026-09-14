// ============================================================================
// services/supabase/trainings.js — catalogue des formations (public.training_catalog).
//
// Le bot (service_role) est la seule source d'écriture : les joueurs n'ont
// qu'un droit de lecture côté jeu (RLS). Un simple INSERT/UPDATE ici suffit à
// faire apparaître/disparaître une formation dans le panneau Alliance du jeu,
// sans aucun déploiement.
// ============================================================================

const { getSupabase } = require("./client");

class TrainingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function listTrainings({ activeOnly } = {}) {
  const supabase = getSupabase();
  let query = supabase.from("training_catalog").select("*").order("service_slug").order("label");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new TrainingError("DB_ERROR", error.message);
  return data || [];
}

async function getTraining(slug) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("training_catalog").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new TrainingError("DB_ERROR", error.message);
  return data;
}

async function createTraining(payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("training_catalog").insert(payload).select().single();
  if (error) {
    if (error.code === "23505") {
      throw new TrainingError("DUPLICATE_SLUG", `Une formation avec le slug \`${payload.slug}\` existe déjà.`);
    }
    throw new TrainingError("DB_ERROR", error.message);
  }
  return data;
}

async function setTrainingActive(slug, active) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("training_catalog")
    .update({ active })
    .eq("slug", slug)
    .select()
    .maybeSingle();
  if (error) throw new TrainingError("DB_ERROR", error.message);
  return data;
}

module.exports = { TrainingError, listTrainings, getTraining, createTraining, setTrainingActive };
