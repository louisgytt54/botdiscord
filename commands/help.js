const { SlashCommandBuilder } = require("discord.js");
const { baseEmbed } = require("../utils/embeds");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Affiche la liste des commandes du bot PC Secours Admin."),

  async execute(interaction) {
    const embed = baseEmbed()
      .setTitle(`📖 Commandes de ${config.branding.name}`)
      .setDescription(
        [
          "**Rôles**",
          "`/role commandement <membre>` — promouvoir un membre au COMMANDEMENT",
          "`/role service <membre> <service>` — attribuer Police/Gendarmerie/Pompier/SAMU 112",
          "`/role retirer <membre> <role>` — retirer un rôle",
          "",
          "**Modération**",
          "`/mod ban|kick|mute|unmute|warn|warnings|clearwarnings`",
          "",
          "**Salons**",
          "`/salon creer <nom> <type>` — créer un salon",
          "`/salon supprimer <salon>` — supprimer un salon",
          "",
          "**Annonces**",
          "`/annonce <titre> <message>` — publier un embed au nom du bot",
          `Ou écris directement dans #${config.channels.annonceRelay} : ton message sera republié en embed.`,
          "",
          "**Missions**",
          "`/mission panneau` — poster le panneau \"Proposer une mission\" (formulaire validé par le COMMANDEMENT)",
          "",
          "**Tickets**",
          "`/ticket panneau` — poster le panneau d'ouverture de ticket",
          "",
          "**Candidatures de service**",
          "`/candidature panneau` — poster le panneau \"Rejoindre un service\" (service → département → centre → formulaire)",
          "`/membre info <membre>` — voir les candidatures/affectations d'un membre",
          "`/membre affecter <membre>` — affecter manuellement un membre à un centre",
          "`/membre suspendre|reactiver|retirer <membre>` — gérer une affectation existante",
          "",
          "**Départements & centres (admin)**",
          "`/departement ajouter-departement` — ouvrir un nouveau département",
          "`/departement centre-ajouter` — créer un centre opérationnel (service + département)",
          "`/departement centre-gerer` — ouvrir/fermer un recrutement, activer/désactiver un centre",
          "`/departement liste` — voir la configuration actuelle",
          "",
          "**Formations (admin)**",
          "`/formation creer` — ajouter une formation au catalogue (visible en jeu immédiatement)",
          "`/formation liste` — voir le catalogue de formations",
          "`/formation activer|desactiver` — afficher/masquer une formation en jeu",
        ].join("\n")
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
