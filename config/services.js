// ============================================================================
// config/services.js — Registre STATIQUE des services (le "type" de service :
// Sapeurs-pompiers, Police nationale, Gendarmerie, SAMU/SMUR...).
//
// Les DONNÉES variables (départements, centres opérationnels, ouverture des
// recrutements) viennent de Supabase et ne sont JAMAIS codées en dur ici —
// voir services/supabase/catalog.js. Ce fichier ne fait que décrire, pour
// chaque service, comment l'afficher côté Discord et quel rôle attribuer.
//
// Pour ajouter un nouveau service (association agréée, etc.) : ajoute une
// entrée ici, crée la ligne correspondante dans la table `services` de
// Supabase (même `slug`), et attribue le rôle Discord voulu. Rien d'autre
// à changer dans le code.
// ============================================================================

const SERVICES = [
  {
    slug: "pompiers",
    label: "Sapeurs-pompiers",
    emoji: "🚒",
    centerTypeLabel: "CTA-CODIS",
    description:
      "Incendies, secours à personne, accidents. Vous engagez les moyens du SDIS de votre département.",
    // Nom (ou ID) du rôle Discord à attribuer — voir config.roles.services.
    discordRole: "Pompier",
    color: 0xc0392b,
  },
  {
    slug: "police-nationale",
    label: "Police nationale",
    emoji: "🚓",
    centerTypeLabel: "CIC",
    description:
      "Sécurité publique, sécurisation d'interventions, patrouilles. Les autres services comptent sur vous.",
    discordRole: "Police",
    color: 0x2980b9,
  },
  {
    slug: "gendarmerie",
    label: "Gendarmerie",
    emoji: "🚔",
    centerTypeLabel: "CORG",
    description:
      "Les territoires hors zone police. Recherches, axes routiers, interventions en zone rurale.",
    discordRole: "Gendarmerie",
    color: 0x27ae60,
  },
  {
    slug: "samu",
    label: "SAMU / SMUR",
    emoji: "🚑",
    centerTypeLabel: "CRRA",
    description:
      "Régulation médicale. Quand un état se dégrade quelque part, c'est vous qu'on appelle.",
    discordRole: "SAMU 112",
    color: 0xe74c3c,
  },
];

function getService(slug) {
  return SERVICES.find((s) => s.slug === slug) || null;
}

// ----------------------------------------------------------------------
// Questions du formulaire de candidature.
// Communes par défaut, redéfinissables par service (fusion, pas remplacement).
// Discord limite un Modal à 5 champs : "Motivations" et "Pourquoi ce
// service" se recoupant, elles sont fusionnées en un seul champ.
// ----------------------------------------------------------------------
const DEFAULT_QUESTIONS = [
  { id: "age", label: "Âge", style: "SHORT", required: true, maxLength: 10 },
  {
    id: "experience",
    label: "Expérience (jeux de régulation / secours)",
    style: "PARAGRAPH",
    required: false,
    maxLength: 500,
  },
  {
    id: "connaissances",
    label: "Connaissances du service choisi",
    style: "PARAGRAPH",
    required: true,
    maxLength: 500,
  },
  {
    id: "disponibilites",
    label: "Disponibilités",
    style: "SHORT",
    required: true,
    maxLength: 200,
  },
  {
    id: "motivations",
    label: "Motivations (pourquoi ce service ?)",
    style: "PARAGRAPH",
    required: true,
    maxLength: 1000,
  },
];

function getQuestions(slug) {
  const service = getService(slug);
  return (service && service.questions) || DEFAULT_QUESTIONS;
}

module.exports = { SERVICES, getService, getQuestions, DEFAULT_QUESTIONS };
