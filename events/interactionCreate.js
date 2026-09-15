// ============================================================================
// Gère TOUTES les interactions : slash commands, boutons (ticket, candidature,
// accepter/refuser) et le modal de candidature.
// ============================================================================

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require("discord.js");
const config = require("../config");
const { findRole, findChannel, hasStaffRole } = require("../utils/resolve");
const { baseEmbed, successEmbed, errorEmbed } = require("../utils/embeds");
const { log } = require("../utils/logger");
const { nextTicketNumber } = require("../utils/storage");
const candidatureFlow = require("../interactions/candidatureFlow");
const applicationReview = require("../interactions/applicationReview");
const membreFlow = require("../interactions/membreFlow");
const departementFlow = require("../interactions/departementFlow");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    try {
      // ---------------------------------------------------------------
      // 1) SLASH COMMANDS
      // ---------------------------------------------------------------
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;
        try {
          await command.execute(interaction);
        } catch (err) {
          console.error(`[interactionCreate] Erreur commande /${interaction.commandName} :`, err);
          const payload = {
            embeds: [errorEmbed("Erreur", "Une erreur est survenue lors de l'exécution de cette commande.")],
            ephemeral: true,
          };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(payload).catch(() => {});
          } else {
            await interaction.reply(payload).catch(() => {});
          }
        }
        return;
      }

      // ---------------------------------------------------------------
      // 1bis) SELECT MENUS (parcours candidature / affectation manuelle)
      // ---------------------------------------------------------------
      if (interaction.isStringSelectMenu()) {
        const id = interaction.customId;

        if (id === "candidature_select_service") return candidatureFlow.handleServiceSelect(interaction);
        if (id.startsWith("cdep:")) return candidatureFlow.handleDepartmentSelect(interaction, id.split(":")[1]);
        if (id.startsWith("ccnt:")) {
          const [, serviceSlug, departmentId] = id.split(":");
          return candidatureFlow.handleCenterSelect(interaction, serviceSlug, departmentId);
        }

        if (id.startsWith("masvc:")) return membreFlow.handleAssignServiceSelect(interaction, id.split(":")[1]);
        if (id.startsWith("madep:")) {
          const [, targetId, serviceSlug] = id.split(":");
          return membreFlow.handleAssignDepartmentSelect(interaction, targetId, serviceSlug);
        }
        if (id.startsWith("macnt:")) {
          const [, targetId, serviceSlug, departmentId] = id.split(":");
          return membreFlow.handleAssignCenterSelect(interaction, targetId, serviceSlug, departmentId);
        }
        if (id.startsWith("masusp:")) return membreFlow.handleSuspendSelect(interaction, id.split(":")[1]);
        if (id.startsWith("mareact:")) return membreFlow.handleReactivateSelect(interaction, id.split(":")[1]);
        if (id.startsWith("maretire:")) return membreFlow.handleRevokeSelect(interaction, id.split(":")[1]);
        if (id === "depcntmgr") return departementFlow.handleCenterManageSelect(interaction);
        return;
      }

      // ---------------------------------------------------------------
      // 2) BOUTONS
      // ---------------------------------------------------------------
      if (interaction.isButton()) {
        const id = interaction.customId;

        // ----- Parcours candidature (confirmation / annulation) -----
        if (id.startsWith("cconf:")) return candidatureFlow.handleConfirmButton(interaction, id.split(":")[1]);
        if (id === "ccancel") return candidatureFlow.handleCancel(interaction);

        // ----- Traitement staff des candidatures -----
        if (id.startsWith("appacc:")) return applicationReview.handleAcceptButton(interaction, id.split(":")[1]);
        if (id.startsWith("appaccok:")) return applicationReview.handleAcceptConfirm(interaction, id.split(":")[1]);
        if (id.startsWith("appaccno:")) return applicationReview.handleAcceptCancel(interaction);
        if (id.startsWith("apprej:")) return applicationReview.handleRejectButton(interaction, id.split(":")[1]);
        if (id.startsWith("appinfo:")) return applicationReview.handleInfoButton(interaction, id.split(":")[1]);

        // ----- Affectation manuelle / suspension / réactivation / retrait -----
        if (id.startsWith("maconf:")) {
          const [, targetId, centerId] = id.split(":");
          return membreFlow.handleAssignConfirm(interaction, targetId, centerId);
        }
        if (id.startsWith("mareactok:")) return membreFlow.handleReactivateConfirm(interaction, id.split(":")[1]);

        // ----- Gestion des centres (/departement centre-gerer) -----
        if (id.startsWith("depopen:")) return departementFlow.handleToggleRecruitment(interaction, id.split(":")[1], true);
        if (id.startsWith("depclose:")) return departementFlow.handleToggleRecruitment(interaction, id.split(":")[1], false);
        if (id.startsWith("depact:")) return departementFlow.handleToggleActive(interaction, id.split(":")[1], true);
        if (id.startsWith("depdeact:")) return departementFlow.handleToggleActive(interaction, id.split(":")[1], false);

        // ----- Ouvrir un ticket -----
        if (id === "ticket_open") {
          // La création du salon + l'envoi du message d'accueil peuvent
          // prendre plus de 3s (appels Discord eux-mêmes) : on défère avant.
          await interaction.deferReply({ ephemeral: true });

          const guild = interaction.guild;
          const category = findChannel(guild, config.channels.ticketCategory);
          const number = nextTicketNumber();
          const channelName = `ticket-${number}`;

          const overwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ];
          const cmdRole = findRole(guild, config.roles.commandement);
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

          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category && category.type === ChannelType.GuildCategory ? category.id : undefined,
            permissionOverwrites: overwrites,
          });

          const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("ticket_close")
              .setLabel("Fermer le ticket")
              .setEmoji("🔒")
              .setStyle(ButtonStyle.Secondary)
          );

          await ticketChannel.send({
            content: `${interaction.user} ${cmdRole ? `<@&${cmdRole.id}>` : ""}`,
            embeds: [
              baseEmbed()
                .setTitle(`🎫 Ticket #${number}`)
                .setDescription(
                  "Merci de décrire ta demande en détail. Un membre du COMMANDEMENT va te répondre dès que possible."
                ),
            ],
            components: [closeRow],
          });

          await interaction.editReply({
            content: `✅ Ton ticket a été créé : ${ticketChannel}`,
          });
          return;
        }

        // ----- Fermer un ticket -----
        if (id === "ticket_close") {
          await interaction.reply({ content: "🔒 Fermeture du ticket dans 5 secondes..." });
          setTimeout(() => {
            interaction.channel.delete().catch(() => {});
          }, 5000);
          return;
        }

        // ----- Proposer une mission -----
        if (id === "mission_open") {
          const modal = new ModalBuilder()
            .setCustomId("mission_modal")
            .setTitle("Proposition de mission");

          const nom = new TextInputBuilder()
            .setCustomId("mission_nom")
            .setLabel("Nom de la mission")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

          const moyens = new TextInputBuilder()
            .setCustomId("mission_moyens")
            .setLabel("Moyens à déclencher (véhicules, unités...)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(500);

          const victimes = new TextInputBuilder()
            .setCustomId("mission_victimes")
            .setLabel("Y a-t-il des victimes ? (Oui / Non)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(50);

          const details = new TextInputBuilder()
            .setCustomId("mission_details")
            .setLabel("Détails / scénario de la mission")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nom),
            new ActionRowBuilder().addComponents(moyens),
            new ActionRowBuilder().addComponents(victimes),
            new ActionRowBuilder().addComponents(details)
          );

          await interaction.showModal(modal);
          return;
        }

        // ----- Accepter / Refuser une proposition de mission -----
        if (id.startsWith("mission_accept_") || id.startsWith("mission_refuse_")) {
          if (!hasStaffRole(interaction.member, [config.roles.commandement])) {
            return interaction.reply({
              embeds: [errorEmbed("Permission refusée", `Seul le rôle **${config.roles.commandement}** peut traiter les propositions de mission.`)],
              ephemeral: true,
            });
          }

          // Le customId a la forme mission_accept_<userId>_<timestamp>
          const parts = id.split("_");
          const proposerId = parts[2];
          const accepted = id.startsWith("mission_accept_");

          // On répond TOUT DE SUITE (aucun appel réseau avant) : la
          // récupération du membre (pour le MP) et le log suivent après,
          // pour ne jamais risquer un "Unknown interaction" (10062).
          const original = interaction.message.embeds[0];
          const updatedEmbed = baseEmbed()
            .setTitle(original.title)
            .setDescription(original.description)
            .addFields(original.fields || [])
            .setColor(accepted ? config.branding.colorSuccess : config.branding.colorDanger)
            .setFooter({ text: accepted ? `✅ Acceptée par ${interaction.user.tag}` : `❌ Refusée par ${interaction.user.tag}` });

          await interaction.update({ embeds: [updatedEmbed], components: [] });

          const proposerMember = await interaction.guild.members.fetch(proposerId).catch(() => null);
          if (proposerMember) {
            proposerMember
              .send({
                embeds: [
                  accepted
                    ? successEmbed("Mission acceptée", `Ta proposition de mission sur **${interaction.guild.name}** a été acceptée par le COMMANDEMENT !`)
                    : errorEmbed("Mission refusée", `Ta proposition de mission sur **${interaction.guild.name}** a été refusée.`),
                ],
              })
              .catch(() => {});
          }

          await log(
            interaction.guild,
            "server",
            baseEmbed()
              .setTitle(accepted ? "✅ Proposition de mission acceptée" : "❌ Proposition de mission refusée")
              .setDescription(`Proposée par : <@${proposerId}>\nTraitée par : ${interaction.user}`)
          );
          return;
        }
      }

      // ---------------------------------------------------------------
      // 3) MODALS
      // ---------------------------------------------------------------
      if (interaction.isModalSubmit()) {
        const mid = interaction.customId;
        if (mid.startsWith("cmodal:")) return candidatureFlow.handleModalSubmit(interaction, mid.split(":")[1]);
        if (mid.startsWith("apprejm:")) return applicationReview.handleRejectModalSubmit(interaction, mid.split(":")[1]);
        if (mid.startsWith("appinfom:")) return applicationReview.handleInfoModalSubmit(interaction, mid.split(":")[1]);
        if (mid.startsWith("masuspm:")) return membreFlow.handleSuspendModalSubmit(interaction, mid.split(":")[1]);
        if (mid.startsWith("maretm:")) return membreFlow.handleRevokeModalSubmit(interaction, mid.split(":")[1]);
      }

      if (interaction.isModalSubmit() && interaction.customId === "mission_modal") {
        // L'envoi du message au salon missions (appel Discord) précède la
        // réponse : on défère tout de suite pour éviter un "Unknown
        // interaction" (10062).
        await interaction.deferReply({ ephemeral: true });

        const nom = interaction.fields.getTextInputValue("mission_nom");
        const moyens = interaction.fields.getTextInputValue("mission_moyens");
        const victimes = interaction.fields.getTextInputValue("mission_victimes");
        const details = interaction.fields.getTextInputValue("mission_details") || "Aucun détail supplémentaire";

        const channel = findChannel(interaction.guild, config.channels.missionsPropositions);
        if (!channel) {
          return interaction.editReply({
            embeds: [errorEmbed("Configuration manquante", `Le salon **${config.channels.missionsPropositions}** est introuvable.`)],
          });
        }

        const embed = baseEmbed()
          .setTitle("🆕 Proposition de mission")
          .setDescription(`Proposée par : ${interaction.user}`)
          .addFields(
            { name: "Nom de la mission", value: nom },
            { name: "Moyens à déclencher", value: moyens },
            { name: "Victimes", value: victimes, inline: true },
            { name: "Détails", value: details }
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_accept_${interaction.user.id}_${Date.now()}`)
            .setLabel("Accepter")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`mission_refuse_${interaction.user.id}_${Date.now()}`)
            .setLabel("Refuser")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.editReply({
          embeds: [successEmbed("Proposition envoyée", "Ta proposition de mission a bien été transmise au COMMANDEMENT. Tu recevras une réponse par message privé.")],
        });
        return;
      }
    } catch (err) {
      console.error("[interactionCreate] Erreur inattendue :", err);
      // Filet de sécurité : si un select menu / bouton / modal plante après
      // avoir été défére/répondu, on informe quand même l'utilisateur au
      // lieu de le laisser sur "L'application n'a pas répondu".
      const payload = { embeds: [errorEmbed("Erreur", "Une erreur est survenue.")], ephemeral: true };
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else if (interaction.isRepliable && interaction.isRepliable()) {
          await interaction.reply(payload);
        }
      } catch (_) {
        // Interaction probablement déjà expirée : rien de plus à faire.
      }
    }
  },
};
