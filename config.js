// ============================================================================
// config.js — Toute la configuration "métier" du bot PC Secours Admin.
// ⚠️ À adapter avec les VRAIS noms/IDs de ton serveur avant de lancer le bot.
// Tu peux mettre soit le NOM du rôle/salon, soit son ID (l'ID est plus fiable
// et plus rapide, mais le nom fonctionne aussi grâce aux fonctions utilitaires
// dans utils/resolve.js).
// ============================================================================

module.exports = {
  // ----------------------------------------------------------------------
  // RÔLES
  // ----------------------------------------------------------------------
  roles: {
    // Rôle donné automatiquement à tout nouveau membre qui rejoint le serveur
    base: "ARM",

    // Rôle "admin" du bot (accès aux commandes sensibles : modération, annonces,
    // gestion des rôles, tickets, etc.)
    commandement: "COMMANDEMENT",

    // Rôles "identité de service" — NE JAMAIS supprimer ni recréer ces rôles,
    // ils servent uniquement à savoir qui est pompier / policier / etc.
    // Le bot peut les attribuer via /role service.
    services: ["Police", "Gendarmerie", "Pompier", "SAMU 112"],

    // Rôle "Opérateur" donné quand une candidature est acceptée
    operateur: "Opérateur",

    // Rôles autorisés à utiliser les commandes de modération (en plus de COMMANDEMENT)
    moderation: ["COMMANDEMENT"],
  },

  // ----------------------------------------------------------------------
  // SALONS (channel names OR IDs — voir utils/resolve.js)
  // ----------------------------------------------------------------------
  channels: {
    // Salon où sont publiées les nouvelles candidatures service/département/centre
    // (boutons Accepter / Refuser / Demander des informations).
    // Voir config/services.js pour la définition des services eux-mêmes.
    candidatures: "candidatures-opérateur",

    // Salon où sont loggées toutes les actions de modération (ban/kick/mute/warn)
    modLogs: "mod-logs",

    // Salon où sont loggés les événements serveur (arrivées/départs, suppressions
    // de messages, changements de rôles, etc.)
    serverLogs: "server-logs",

    // Salon "relais d'annonces" : tout message écrit ici par un membre autorisé
    // est automatiquement supprimé et republié par le bot sous forme d'embed.
    annonceRelay: "annonces",

    // Catégorie sous laquelle les tickets seront créés
    ticketCategory: "TICKETS",

    // Salon où le panneau "Ouvrir un ticket" est posté
    ticketPanel: "support",

    // Salon où sont envoyées les propositions de mission (idées d'ajout de
    // missions) faites via /mission, avec boutons Accepter/Refuser
    missionsPropositions: "propositions-missions",
  },

  // ----------------------------------------------------------------------
  // APPARENCE DES EMBEDS DU BOT
  // ----------------------------------------------------------------------
  branding: {
    name: "PC Secours Admin",
    color: 0xc0392b, // rouge "urgence"
    colorSuccess: 0x2ecc71,
    colorWarning: 0xf39c12,
    colorDanger: 0xe74c3c,
    footer: "PC Secours | Régulation 15-17-18-112",
    // Mets ici une URL d'icône si tu en as une (logo SDIS/PC Secours), sinon laisse null
    iconURL: null,
  },

  // ----------------------------------------------------------------------
  // DIVERS
  // ----------------------------------------------------------------------
  settings: {
    // Durée max de mute (timeout Discord) autorisée, en minutes
    maxMuteMinutes: 40320, // 28 jours (limite Discord)
  },
};
