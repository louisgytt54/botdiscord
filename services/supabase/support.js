// ============================================================================
// services/supabase/support.js — pont Discord <-> jeu pour le système de
// tickets support et les annonces du Centre opérationnel (mise à jour 0055).
//
// Système UNIFIÉ : que le ticket soit ouvert depuis le jeu (RPC
// create_support_ticket) ou depuis Discord (bouton "Ouvrir un ticket" du
// panneau existant, voir events/interactionCreate.js), il vit dans la même
// table Supabase `support_tickets` et son salon Discord est créé dans la
// même catégorie (config.channels.ticketCategory). La création réelle du
// salon Discord est toujours déclenchée ICI, par l'abonnement Realtime sur
// `support_tickets` — ainsi les deux origines suivent exactement le même
// chemin de code et restent visuellement identiques.
//
// Règle anti-écho : toute ligne insérée dans `support_ticket_messages` avec
// un `discord_message_id` déjà renseigné ne sera PAS re-publiée dans Discord
// (elle vient de Discord). Les messages insérés par le JEU (via ses RPC)
// n'ont jamais de discord_message_id au moment de l'insertion : ce sont eux
// qu'on doit recopier vers Discord.
// ============================================================================

const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { getSupabase } = require("./client");
const { getDiscordIdByProfileId } = require("./profiles");
const { findChannel, findRole } = require("../../utils/resolve");
const { baseEmbed } = require("../../utils/embeds");
const config = require("../../config");

const PRIORITY_LABELS = {
  urgent: "🔴 Urgent",
  normal: "🟠 Normal",
  info: "🔵 Info",
};

// ----------------------------------------------------------------------
// Accès Supabase bas niveau
// ----------------------------------------------------------------------

async function getTicketById(ticketId) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) {
    console.error("[support] Erreur getTicketById :", error.message);
    return null;
  }
  return data;
}

async function getOpenTicketByChannelId(channelId) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("discord_channel_id", channelId)
    .eq("status", "open")
    .maybeSingle();
  if (error) {
    console.error("[support] Erreur getOpenTicketByChannelId :", error.message);
    return null;
  }
  return data;
}

/**
 * Crée un ticket pour un utilisateur Discord dont le compte jeu est lié
 * (profil retrouvé via son ID Discord). Insère aussi le premier message
 * (author_role='player', sans discord_message_id : il sera donc recopié
 * automatiquement dans le salon Discord dès que celui-ci existera, comme
 * n'importe quel message venant du jeu).
 */
async function createTicketFromDiscordUser({ profileId, authorName, subject, body }) {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase non configuré" };

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({ user_id: profileId, subject })
    .select()
    .single();
  if (ticketError) {
    console.error("[support] Erreur création ticket (Discord) :", ticketError.message);
    return { error: ticketError.message };
  }

  const { error: messageError } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    author_role: "player",
    author_name: authorName,
    body,
  });
  if (messageError) {
    console.error("[support] Erreur message initial (Discord) :", messageError.message);
    // Non bloquant : le ticket existe déjà, le salon sera quand même créé.
  }

  return { ticket };
}

/** Insère un message émis depuis Discord (joueur écrivant dans son propre
 * salon de ticket, ou membre du staff qui répond). discord_message_id est
 * TOUJOURS renseigné pour éviter que ce message ne soit recopié dans le
 * salon d'où il vient déjà. */
async function insertMessageFromDiscord({ ticketId, authorRole, authorName, body, discordMessageId }) {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase non configuré" };
  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    author_role: authorRole,
    author_name: authorName,
    body,
    discord_message_id: discordMessageId,
  });
  if (error) {
    console.error("[support] Erreur insertMessageFromDiscord :", error.message);
    return { error: error.message };
  }
  return { ok: true };
}

async function markMessageDelivered(messageId, discordMessageId) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("support_ticket_messages")
    .update({ discord_message_id: discordMessageId })
    .eq("id", messageId);
  if (error) {
    console.error("[support] Erreur markMessageDelivered :", error.message);
  }
}

async function setTicketChannel(ticketId, channelId) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("support_tickets")
    .update({ discord_channel_id: channelId })
    .eq("id", ticketId);
  if (error) {
    console.error("[support] Erreur setTicketChannel :", error.message);
  }
}

async function closeTicket(ticketId) {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase non configuré" };
  const { error } = await supabase
    .from("support_tickets")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) {
    console.error("[support] Erreur closeTicket :", error.message);
    return { error: error.message };
  }
  return { ok: true };
}

async function insertAnnouncement({ subject, body, priority, discordMessageId }) {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase non configuré" };
  const { error } = await supabase.from("operational_announcements").insert({
    subject,
    body,
    priority,
    discord_message_id: discordMessageId,
  });
  if (error) {
    console.error("[support] Erreur insertAnnouncement :", error.message);
    return { error: error.message };
  }
  return { ok: true };
}

/**
 * Attend (avec un petit backoff) que le salon Discord d'un ticket soit créé
 * par le pont Realtime, puis le renvoie. Utilisé après une création de
 * ticket depuis Discord pour pouvoir donner le lien du salon à l'utilisateur
 * sans attendre indéfiniment (l'éditReply doit rester rapide).
 */
async function waitForTicketChannel(guild, ticketId, { attempts = 6, delayMs = 700 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const ticket = await getTicketById(ticketId);
    if (ticket && ticket.discord_channel_id) {
      const channel =
        guild.channels.cache.get(ticket.discord_channel_id) ||
        (await guild.channels.fetch(ticket.discord_channel_id).catch(() => null));
      if (channel) return channel;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

// ----------------------------------------------------------------------
// Création du salon Discord (partagée par les deux origines de ticket)
// ----------------------------------------------------------------------

async function buildTicketChannel(guild, ticket) {
  const category = findChannel(guild, config.channels.ticketCategory);
  const cmdRole = findRole(guild, config.roles.commandement);
  const ownerDiscordId = await getDiscordIdByProfileId(ticket.user_id);

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
  ];
  if (ownerDiscordId) {
    overwrites.push({
      id: ownerDiscordId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }
  if (cmdRole) {
    overwrites.push({
      id: cmdRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: `ticket-${ticket.ticket_number}`,
    type: ChannelType.GuildText,
    parent: category && category.type === ChannelType.GuildCategory ? category.id : undefined,
    permissionOverwrites: overwrites,
  });

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticketjeu_close:${ticket.id}`)
      .setLabel("Fermer le ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Secondary)
  );

  await channel.send({
    content: `${ownerDiscordId ? `<@${ownerDiscordId}>` : ""} ${cmdRole ? `<@&${cmdRole.id}>` : ""}`.trim(),
    embeds: [
      baseEmbed()
        .setTitle(`🎫 Ticket #${ticket.ticket_number}`)
        .setDescription(
          `**Sujet :** ${ticket.subject}\n\nCe ticket est synchronisé en temps réel avec le jeu. Les messages échangés ici apparaissent côté joueur, et inversement.`
        ),
    ],
    components: [closeRow],
  });

  await setTicketChannel(ticket.id, channel.id);
  return channel;
}

// ----------------------------------------------------------------------
// Handlers Realtime
// ----------------------------------------------------------------------

async function handleNewTicket(client, row) {
  if (row.discord_channel_id) return; // déjà traité (ne devrait pas arriver sur un INSERT, sécurité)
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) {
    console.error("[support] Guild introuvable (GUILD_ID) : impossible de créer le salon du ticket.");
    return;
  }
  await buildTicketChannel(guild, row);
}

async function handleNewPlayerMessage(client, row) {
  if (row.discord_message_id) return; // déjà publié côté Discord, ne pas ré-écrire
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  const channel = await waitForTicketChannel(guild, row.ticket_id);
  if (!channel) {
    console.warn(`[support] Salon introuvable pour le ticket ${row.ticket_id} (message ${row.id} non publié).`);
    return;
  }

  const sent = await channel
    .send({
      embeds: [
        baseEmbed()
          .setAuthor({ name: `${row.author_name} (jeu)` })
          .setDescription(row.body),
      ],
    })
    .catch((err) => {
      console.error("[support] Erreur envoi message ticket vers Discord :", err.message);
      return null;
    });

  if (sent) await markMessageDelivered(row.id, sent.id);
}

/**
 * Démarre l'abonnement Supabase Realtime pour le pont tickets/annonces.
 * À appeler une fois le client Discord prêt (voir events/ticketBridgeReady.js).
 */
function subscribeSupportRealtime(client) {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn("[support] Supabase non configuré : le pont tickets Discord ↔ jeu est désactivé.");
    return null;
  }

  const channel = supabase
    .channel("bot-support-bridge")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "support_tickets" },
      (payload) => {
        handleNewTicket(client, payload.new).catch((err) =>
          console.error("[support] handleNewTicket :", err)
        );
      }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "support_ticket_messages" },
      (payload) => {
        if (payload.new.author_role !== "player") return;
        handleNewPlayerMessage(client, payload.new).catch((err) =>
          console.error("[support] handleNewPlayerMessage :", err)
        );
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[support] Pont tickets Discord ↔ jeu actif (Realtime).");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.error(`[support] Statut Realtime inattendu : ${status}`);
      }
    });

  return channel;
}

module.exports = {
  PRIORITY_LABELS,
  getTicketById,
  getOpenTicketByChannelId,
  createTicketFromDiscordUser,
  insertMessageFromDiscord,
  closeTicket,
  insertAnnouncement,
  waitForTicketChannel,
  subscribeSupportRealtime,
};
