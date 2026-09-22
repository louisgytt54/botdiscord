// ============================================================================
// events/supportTicketMessage.js — recopie dans Supabase (support_ticket_messages)
// tout message écrit dans un salon de ticket synchronisé avec le jeu, pour
// qu'il apparaisse en temps réel côté joueur.
//
// Fichier séparé de events/messageCreate.js (relais d'annonces) : les deux
// écoutent "messageCreate" indépendamment, loadEvents.js le permet.
// ============================================================================

const { getOpenTicketByChannelId, insertMessageFromDiscord } = require("../services/supabase/support");
const { getDiscordIdByProfileId } = require("../services/supabase/profiles");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const body = message.content?.trim();
    if (!body) return; // pièce jointe seule, etc. : rien à recopier pour l'instant

    const ticket = await getOpenTicketByChannelId(message.channel.id);
    if (!ticket) return;

    const ownerDiscordId = await getDiscordIdByProfileId(ticket.user_id);
    const isOwner = ownerDiscordId && ownerDiscordId === message.author.id;
    const authorName = message.member?.displayName || message.author.username;

    await insertMessageFromDiscord({
      ticketId: ticket.id,
      authorRole: isOwner ? "player" : "support",
      authorName,
      body,
      discordMessageId: message.id,
    });
  },
};
