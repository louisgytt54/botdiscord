// ============================================================================
// events/ticketBridgeReady.js — démarre le pont tickets Discord <-> jeu
// (Supabase Realtime) une fois le bot connecté. Fichier séparé de
// events/ready.js pour ne pas toucher au code déjà testé (loadEvents.js
// autorise plusieurs listeners "ready", chacun protégé par son propre
// filet .catch()).
// ============================================================================

const { subscribeSupportRealtime } = require("../services/supabase/support");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    subscribeSupportRealtime(client);
  },
};
