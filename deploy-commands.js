// ============================================================================
// deploy-commands.js — enregistre les slash commands sur Discord.
// À exécuter une fois (et à chaque fois que tu ajoutes/modifies une commande) :
//   node deploy-commands.js
//
// Enregistre les commandes au niveau de GUILD_ID (instantané, idéal pour un
// seul serveur). Si tu veux un jour les rendre globales (tous serveurs,
// propagation ~1h), remplace applicationGuildCommands par applicationCommands.
// ============================================================================

require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ DISCORD_TOKEN, CLIENT_ID ou GUILD_ID manquant dans .env");
  process.exit(1);
}

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

const commands = [];
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command?.data) commands.push(command.data.toJSON());
}

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`⏳ Déploiement de ${commands.length} commande(s)...`);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Commandes déployées avec succès sur le serveur.");
  } catch (err) {
    console.error("❌ Erreur lors du déploiement des commandes :", err);
  }
})();
