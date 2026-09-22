// ============================================================================
// events/supportTicketInteractions.js — gère la fermeture des tickets
// synchronisés avec le jeu (bouton "Fermer le ticket", customId
// "ticketjeu_close:<id>"). Fichier séparé de events/interactionCreate.js :
// les deux écoutent "interactionCreate" indépendamment (loadEvents.js le
// permet), ce qui évite de toucher au routage déjà testé de l'autre fichier.
// Seul le bot/staff Discord peut fermer un ticket : le jeu ne le peut jamais
// (voir SUPABASE_UPDATE_0055_SUPPORT_DISCORD.sql).
// ============================================================================

const { closeTicket } = require("../services/supabase/support");
const { errorEmbed } = require("../utils/embeds");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("ticketjeu_close:")) return;

    const ticketId = interaction.customId.split(":")[1];

    try {
      await interaction.reply({ content: "🔒 Fermeture du ticket dans 5 secondes..." });
    } catch (err) {
      console.error("[supportTicketInteractions] Erreur reply :", err);
      return;
    }

    const result = await closeTicket(ticketId);
    if (result.error) {
      await interaction.followUp({
        embeds: [errorEmbed("Erreur", "Le ticket n'a pas pu être marqué comme fermé côté jeu, mais le salon va quand même être supprimé.")],
        ephemeral: true,
      }).catch(() => {});
    }

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
  },
};
