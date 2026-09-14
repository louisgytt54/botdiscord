// ============================================================================
// services/permissions.js — vérifications de permissions pour le système de
// candidatures / affectations. Centralisé ici pour que toutes les commandes
// et interactions utilisent EXACTEMENT la même règle.
// ============================================================================

const config = require("../config");
const { hasStaffRole } = require("../utils/resolve");

/** Peut traiter les candidatures, gérer les affectations, l'administration des centres. */
function isRecruiter(member) {
  return hasStaffRole(member, [config.roles.commandement, ...config.roles.moderation]);
}

module.exports = { isRecruiter };
