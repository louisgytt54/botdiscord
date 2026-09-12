const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");

/**
 * Charge tous les fichiers de commandes du dossier /commands dans client.commands
 * @param {import('discord.js').Client} client
 */
function loadCommands(client) {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, "..", "commands");
  const files = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith(".js"));

  const commandsJSON = [];

  for (const file of files) {
    const command = require(path.join(commandsPath, file));
    if (!command?.data || !command?.execute) {
      console.warn(`[commands] ${file} ignoré (manque "data" ou "execute")`);
      continue;
    }
    client.commands.set(command.data.name, command);
    commandsJSON.push(command.data.toJSON());
  }

  console.log(`[commands] ${client.commands.size} commande(s) chargée(s).`);
  return commandsJSON;
}

module.exports = { loadCommands };
