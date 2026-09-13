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
      // 2) BOUTONS
      // ---------------------------------------------------------------
      if (interaction.isButton()) {
        const id = interaction.customId;

        // ----- Ouvrir un ticket -----
        if (id === "ticket_open") {
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

          await interaction.reply({
            content: `✅ Ton ticket a été créé : ${ticketChannel}`,
            ephemeral: true,
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

        // ----- Postuler (candidature) -----
        if (id === "candidature_open") {
          const modal = new ModalBuilder()
            .setCustomId("candidature_modal")
            .setTitle("Candidature Opérateur");

          const motivation = new TextInputBuilder()
            .setCustomId("candidature_motivation")
            .setLabel("Pourquoi veux-tu devenir opérateur ?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

          const experience = new TextInputBuilder()
            .setCustomId("candidature_experience")
            .setLabel("As-tu déjà de l'expérience (RP, jeu) ?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000);

          const dispo = new TextInputBuilder()
            .setCustomId("candidature_dispo")
            .setLabel("Quelles sont tes disponibilités ?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200);

          modal.addComponents(
            new ActionRowBuilder().addComponents(motivation),
            new ActionRowBuilder().addComponents(experience),
            new ActionRowBuilder().addComponents(dispo)
          );

          await interaction.showModal(modal);
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

        // ----- Accepter / Refuser une candidature -----
        if (id.startsWith("candidature_accept_") || id.startsWith("candidature_refuse_")) {
          if (!hasStaffRole(interaction.member, [config.roles.commandement])) {
            return interaction.reply({
              embeds: [errorEmbed("Permission refusée", `Seul le rôle **${config.roles.commandement}** peut traiter les candidatures.`)],
              ephemeral: true,
            });
          }

          const candidateId = id.split("_").pop();
          const candidateMember = await interaction.guild.members.fetch(candidateId).catch(() => null);
          const accepted = id.startsWith("candidature_accept_");

          if (accepted && candidateMember) {
            const role = findRole(interaction.guild, config.roles.operateur);
            if (role) await candidateMember.roles.add(role);
          }

          const original = interaction.message.embeds[0];
          const updatedEmbed = baseEmbed()
            .setTitle(original.title)
            .setDescription(original.description)
            .addFields(original.fields || [])
            .setColor(accepted ? config.branding.colorSuccess : config.branding.colorDanger)
            .setFooter({ text: accepted ? `✅ Acceptée par ${interaction.user.tag}` : `❌ Refusée par ${interaction.user.tag}` });

          await interaction.update({ embeds: [updatedEmbed], components: [] });

          if (candidateMember) {
            candidateMember
              .send({
                embeds: [
                  accepted
                    ? successEmbed("Candidature acceptée", `Félicitations, ta candidature d'opérateur sur **${interaction.guild.name}** a été acceptée !`)
                    : errorEmbed("Candidature refusée", `Ta candidature d'opérateur sur **${interaction.guild.name}** a été refusée.`),
                ],
              })
              .catch(() => {});
          }

          await log(
            interaction.guild,
            "server",
            baseEmbed()
              .setTitle(accepted ? "✅ Candidature acceptée" : "❌ Candidature refusée")
              .setDescription(`Candidat : <@${candidateId}>\nTraitée par : ${interaction.user}`)
          );
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
          const proposerMember = await interaction.guild.members.fetch(proposerId).catch(() => null);

          const original = interaction.message.embeds[0];
          const updatedEmbed = baseEmbed()
            .setTitle(original.title)
            .setDescription(original.description)
            .addFields(original.fields || [])
            .setColor(accepted ? config.branding.colorSuccess : config.branding.colorDanger)
            .setFooter({ text: accepted ? `✅ Acceptée par ${interaction.user.tag}` : `❌ Refusée par ${interaction.user.tag}` });

          await interaction.update({ embeds: [updatedEmbed], components: [] });

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
      if (interaction.isModalSubmit() && interaction.customId === "mission_modal") {
        const nom = interaction.fields.getTextInputValue("mission_nom");
        const moyens = interaction.fields.getTextInputValue("mission_moyens");
        const victimes = interaction.fields.getTextInputValue("mission_victimes");
        const details = interaction.fields.getTextInputValue("mission_details") || "Aucun détail supplémentaire";

        const channel = findChannel(interaction.guild, config.channels.missionsPropositions);
        if (!channel) {
          return interaction.reply({
            embeds: [errorEmbed("Configuration manquante", `Le salon **${config.channels.missionsPropositions}** est introuvable.`)],
            ephemeral: true,
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
        await interaction.reply({
          embeds: [successEmbed("Proposition envoyée", "Ta proposition de mission a bien été transmise au COMMANDEMENT. Tu recevras une réponse par message privé.")],
          ephemeral: true,
        });
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId === "candidature_modal") {
        const motivation = interaction.fields.getTextInputValue("candidature_motivation");
        const experience = interaction.fields.getTextInputValue("candidature_experience") || "Non renseigné";
        const dispo = interaction.fields.getTextInputValue("candidature_dispo");

        const channel = findChannel(interaction.guild, config.channels.candidatures);
        if (!channel) {
          return interaction.reply({
            embeds: [errorEmbed("Configuration manquante", `Le salon **${config.channels.candidatures}** est introuvable.`)],
            ephemeral: true,
          });
        }

        const embed = baseEmbed()
          .setTitle("📋 Nouvelle candidature Opérateur")
          .setDescription(`Candidat : ${interaction.user}`)
          .addFields(
            { name: "Motivation", value: motivation },
            { name: "Expérience", value: experience },
            { name: "Disponibilités", value: dispo }
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`candidature_accept_${interaction.user.id}`)
            .setLabel("Accepter")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`candidature_refuse_${interaction.user.id}`)
            .setLabel("Refuser")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({
          embeds: [successEmbed("Candidature envoyée", "Ta candidature a bien été transmise au COMMANDEMENT. Tu recevras une réponse par message privé.")],
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error("[interactionCreate] Erreur inattendue :", err);
    }
  },
};
