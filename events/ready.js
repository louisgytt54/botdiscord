const { ActivityType } = require("discord.js");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
    client.user.setPresence({
      activities: [{ name: "PC Secours | 15-17-18-112", type: ActivityType.Watching }],
      status: "online",
    });
  },
};
