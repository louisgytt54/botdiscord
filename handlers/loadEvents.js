const fs = require("fs");
const path = require("path");

/**
 * Charge tous les fichiers d'événements du dossier /events et les attache au client.
 * @param {import('discord.js').Client} client
 */
function loadEvents(client) {
  const eventsPath = path.join(__dirname, "..", "events");
  const files = fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    const event = require(path.join(eventsPath, file));
    if (!event?.name || !event?.execute) {
      console.warn(`[events] ${file} ignoré (manque "name" ou "execute")`);
      continue;
    }
    // IMPORTANT : on enveloppe chaque event.execute() avec .catch(). Sans ça,
    // une erreur/rejection dans N'IMPORTE QUEL fichier events/*.js (même un
    // simple bug ponctuel, une erreur Supabase, etc.) devient une "unhandled
    // promise rejection" que Node.js fait remonter jusqu'à planter TOUT LE
    // PROCESSUS BOT — un incident réel (colonne Supabase manquante dans
    // membreFlow.js) a provoqué exactement ça le 15/09. Ce filet de sécurité
    // logge l'erreur au lieu de tuer le bot.
    const safeExecute = (...args) =>
      Promise.resolve(event.execute(...args, client)).catch((err) => {
        console.error(`[events] Erreur non gérée dans "${event.name}" (${file}) :`, err);
      });

    if (event.once) {
      client.once(event.name, safeExecute);
    } else {
      client.on(event.name, safeExecute);
    }
  }

  console.log(`[events] ${files.length} événement(s) chargé(s).`);
}

module.exports = { loadEvents };
