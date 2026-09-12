// ============================================================================
// index.js — point d'entrée du bot PC Secours Admin.
// Lance : node index.js  (après avoir fait "npm install" et configuré .env)
// ============================================================================

require("dotenv").config();
const { Client, GatewayIntentBits, Partials, REST, Routes } = require("discord.js");
const { loadCommands } = require("./handlers/loadCommands");
const { loadEvents } = require("./handlers/loadEvents");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN manquant. Vérifie tes variables d'environnement (voir .env.example)."
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

const commandsJSON = loadCommands(client); // charge client.commands (utilisé par interactionCreate)
loadEvents(client); // charge tous les events/*.js

// ----------------------------------------------------------------------
// Enregistrement automatique des slash commands au démarrage.
// Beaucoup d'hébergeurs (comme ecloudserv) ne permettent pas de lancer
// "node deploy-commands.js" séparément : on le fait donc ici, à chaque
// démarrage du bot, pour ne jamais oublier cette étape.
// ----------------------------------------------------------------------
async function deploySlashCommands() {
  if (!CLIENT_ID || !GUILD_ID) {
    console.warn(
      "⚠️ CLIENT_ID ou GUILD_ID manquant : les commandes slash n'ont pas pu être enregistrées."
    );
    return;
  }
  try {
    const rest = new REST().setToken(DISCORD_TOKEN);
    console.log(`⏳ Enregistrement de ${commandsJSON.length} commande(s) slash...`);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commandsJSON,
    });
    console.log("✅ Commandes slash enregistrées avec succès.");
  } catch (err) {
    console.error("❌ Erreur lors de l'enregistrement des commandes slash :", err.message);
  }
}

client.login(DISCORD_TOKEN)
  .then(() => deploySlashCommands())
  .catch((err) => {
    console.error("❌ Échec de connexion à Discord :", err.message);
    process.exit(1);
  });

process.on("unhandledRejection", (err) => {
  console.error("❌ Rejection non gérée :", err);
});