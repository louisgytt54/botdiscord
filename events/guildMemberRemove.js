const { baseEmbed } = require("../utils/embeds");
const { log } = require("../utils/logger");

module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    await log(
      member.guild,
      "server",
      baseEmbed()
        .setTitle("📤 Départ d'un membre")
        .setDescription(`**${member.user.tag}** a quitté le serveur.`)
    );
  },
};
