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
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }

  console.log(`[events] ${files.length} événement(s) chargé(s).`);
}

module.exports = { loadEvents };
