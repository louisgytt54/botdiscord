// ============================================================================
// /salon creer — création rapide d'un salon (texte ou vocal), avec catégorie
// optionnelle. Réservé au COMMANDEMENT.
// ============================================================================

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const config = require("../config");
const { hasStaffRole, findChannel } = require("../utils/resolve");
const { successEmbed, errorEmbed } = require("../utils/embeds");
const { log } = require("../utils/logger");
const { baseEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("salon")
    .setDescription("Gestion rapide des salons")
    .addSubcommand((sub) =>
      sub
        .setName("creer")
        .setDescription("Créer un nouveau salon")
        .addStringOption((o) =>
          o.setName("nom").setDescription("Nom du salon").setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName("type")
            .setDescription("Type de salon")
            .setRequired(true)
            .addChoices(
              { name: "Texte", value: "texte" },
              { name: "Vocal", value: "vocal" }
            )
        )
        .addStringOption((o) =>
          o
            .setName("categorie")
            .setDescription("Nom de la catégorie où créer le salon (optionnel)")
            .setRequired(false)
        )
        .addBooleanOption((o) =>
          o
            .setName("prive")
            .setDescription("Rendre le salon privé (visible par COMMANDEMENT uniquement)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("supprimer")
        .setDescription("Supprimer un salon")
        .addChannelOption((o) =>
          o.setName("salon").setDescription("Salon à supprimer").setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!hasStaffRole(interaction.member, [config.roles.commandement])) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Permission refusée",
            `Seul le rôle **${config.roles.commandement}** peut gérer les salons.`
          ),
        ],
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "creer") {
      const nom = interaction.options.getString("nom");
      const type = interaction.options.getString("type");
      const categorieNom = interaction.options.getString("categorie");
      const prive = interaction.options.getBoolean("prive") || false;

      let parent = null;
      if (categorieNom) {
        parent = findChannel(interaction.guild, categorieNom);
        if (!parent || parent.type !== ChannelType.GuildCategory) {
          return interaction.reply({
            embeds: [errorEmbed("Catégorie introuvable", `Aucune catégorie nommée **${categorieNom}**.`)],
            ephemeral: true,
          });
        }
      }

      const overwrites = [];
      if (prive) {
        overwrites.push({
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        });
        const cmdRole = interaction.guild.roles.cache.find(
          (r) => r.name.toLowerCase() === config.roles.commandement.toLowerCase()
        );
        if (cmdRole) {
          overwrites.push({
            id: cmdRole.id,
            allow: [PermissionFlagsBits.ViewChannel],
          });
        }
      }

      const channel = await interaction.guild.channels.create({
        name: nom,
        type: type === "vocal" ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: parent ? parent.id : undefined,
        permissionOverwrites: overwrites.length ? overwrites : undefined,
      });

      await interaction.reply({
        embeds: [successEmbed("Salon créé", `${channel} a été créé avec succès.`)],
      });
      await log(
        interaction.guild,
        "server",
        baseEmbed().setTitle("📁 Salon créé").setDescription(`${channel} créé par ${interaction.user}.`)
      );
      return;
    }

    if (sub === "supprimer") {
      const channel = interaction.options.getChannel("salon");
      const name = channel.name;
      await channel.delete(`Supprimé par ${interaction.user.tag}`);
      await interaction.reply({ embeds: [successEmbed("Salon supprimé", `Le salon **${name}** a été supprimé.`)] });
      await log(
        interaction.guild,
        "server",
        baseEmbed().setTitle("🗑️ Salon supprimé").setDescription(`**#${name}** supprimé par ${interaction.user}.`)
      );
    }
  },
};
