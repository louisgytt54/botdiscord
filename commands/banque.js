// ============================================================================
// /banque — ajouter, retirer ou consulter les crédits d'un joueur. Écrit
// directement dans le système économique déjà existant du jeu
// (player_wallets.credits + journal player_transactions), voir
// SUPABASE_UPDATE_BOT_BANQUE_DISCORD.sql. RÉSERVÉ à une seule personne :
// l'ID Discord défini dans .env (BANK_ADMIN_DISCORD_ID). Ce n'est PAS une
// restriction par rôle : même le COMMANDEMENT ne peut pas l'utiliser,
// uniquement le compte configuré.
// ============================================================================

const { SlashCommandBuilder } = require("discord.js");
const { errorEmbed, successEmbed, baseEmbed } = require("../utils/embeds");
const { log } = require("../utils/logger");
const { getProfileByDiscordId } = require("../services/supabase/profiles");
const { getBalance, adjustBalance } = require("../services/supabase/bank");

function isAuthorized(interaction) {
  const allowedId = process.env.BANK_ADMIN_DISCORD_ID;
  return Boolean(allowedId) && interaction.user.id === allowedId;
}

async function resolveProfileOrReply(interaction, joueur) {
  const profile = await getProfileByDiscordId(joueur.id);
  if (!profile) {
    await interaction.editReply({
      embeds: [
        errorEmbed(
          "Compte jeu non lié",
          `${joueur} ne s'est jamais connecté au jeu via Discord : impossible de retrouver son compte.`
        ),
      ],
    });
    return null;
  }
  return profile;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("banque")
    .setDescription("Gère les crédits en jeu d'un joueur (réservé)")
    .addSubcommand((sub) =>
      sub
        .setName("ajouter")
        .setDescription("Ajoute des crédits au portefeuille d'un joueur")
        .addUserOption((opt) =>
          opt.setName("joueur").setDescription("Le joueur concerné").setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName("montant").setDescription("Montant à ajouter").setRequired(true).setMinValue(1)
        )
        .addStringOption((opt) =>
          opt.setName("raison").setDescription("Raison de l'opération (optionnel)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("retirer")
        .setDescription("Retire des crédits du portefeuille d'un joueur")
        .addUserOption((opt) =>
          opt.setName("joueur").setDescription("Le joueur concerné").setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName("montant").setDescription("Montant à retirer").setRequired(true).setMinValue(1)
        )
        .addStringOption((opt) =>
          opt.setName("raison").setDescription("Raison de l'opération (optionnel)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("solde")
        .setDescription("Consulte le solde d'un joueur")
        .addUserOption((opt) =>
          opt.setName("joueur").setDescription("Le joueur concerné").setRequired(true)
        )
    ),
  // Pas de setDefaultMemberPermissions ici : la restriction n'est PAS un rôle
  // Discord, elle est vérifiée dans le code (isAuthorized) pour un seul ID.

  async execute(interaction) {
    if (!isAuthorized(interaction)) {
      return interaction.reply({
        embeds: [errorEmbed("Permission refusée", "Cette commande est réservée.")],
        ephemeral: true,
      });
    }

    // Les appels Supabase peuvent dépasser la fenêtre de 3s : on défère avant.
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const joueur = interaction.options.getUser("joueur");

    if (sub === "solde") {
      const profile = await resolveProfileOrReply(interaction, joueur);
      if (!profile) return;

      const result = await getBalance(profile.id);
      if (result.error) {
        await interaction.editReply({
          embeds: [errorEmbed("Erreur", `Impossible de récupérer le solde : ${result.error}`)],
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle("💰 Solde")
            .setDescription(`**${joueur}** : ${result.balance} crédits`),
        ],
      });
      return;
    }

    const montant = interaction.options.getInteger("montant");
    const raison = interaction.options.getString("raison");
    const signedAmount = sub === "ajouter" ? montant : -montant;

    const profile = await resolveProfileOrReply(interaction, joueur);
    if (!profile) return;

    const result = await adjustBalance({
      profileId: profile.id,
      amount: signedAmount,
      reason: raison,
      actorDiscordId: interaction.user.id,
    });

    if (result.error) {
      await interaction.editReply({
        embeds: [errorEmbed("Opération refusée", result.error)],
      });
      return;
    }

    const verbe = sub === "ajouter" ? "ajoutés à" : "retirés de";
    await interaction.editReply({
      embeds: [
        successEmbed(
          "Opération effectuée",
          `**${montant} crédits** ${verbe} la banque de ${joueur}.\nNouveau solde : **${result.balance} crédits**${
            raison ? `\nRaison : ${raison}` : ""
          }`
        ),
      ],
    });

    // Traçabilité : toute manipulation de crédits est loggée (salon mod-logs)
    // ET journalisée dans player_transactions (visible côté jeu comme
    // n'importe quelle autre transaction).
    await log(
      interaction.guild,
      "mod",
      baseEmbed()
        .setTitle(sub === "ajouter" ? "💰 Ajout de crédits (banque)" : "💸 Retrait de crédits (banque)")
        .addFields(
          { name: "Joueur", value: `${joueur}`, inline: true },
          { name: "Montant", value: `${montant} crédits`, inline: true },
          { name: "Nouveau solde", value: `${result.balance} crédits`, inline: true },
          { name: "Effectué par", value: `${interaction.user}`, inline: false },
          { name: "Raison", value: raison || "Aucune raison fournie", inline: false }
        )
    );
  },
};
