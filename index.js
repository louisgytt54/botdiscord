// ============================================================================
// index.js — point d'entrée du bot PC Secours Admin.
// Lance : node index.js  (après avoir fait "npm install" et configuré .env)
// ============================================================================

require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { loadCommands } = require("./handlers/loadCommands");
const { loadEvents } = require("./handlers/loadEvents");

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN manquant. Vérifie ton fichier .env (voir .env.example)."
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

loadCommands(client); // charge client.commands (utilisé par interactionCreate)
loadEvents(client); // charge tous les events/*.js

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("❌ Échec de connexion à Discord :", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Rejection non gérée :", err);
});
