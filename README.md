# PC Secours Admin — Bot Discord

Bot d'administration complet pour le serveur **PC Secours | Régulation 15-17-18-112**.
Objectif : remplacer à terme tous les autres bots du serveur.

## Fonctionnalités incluses

- 🟢 Attribution automatique du rôle **ARM** à chaque nouveau membre
- 👑 Gestion des rôles : `/role commandement`, `/role service`, `/role retirer`
- 🛡️ Modération classique : `/mod ban|kick|mute|unmute|warn|warnings|clearwarnings` (loggée dans `#mod-logs`)
- 📋 Système de candidature Opérateur (bouton **Postuler** → formulaire → validation par boutons Accepter/Refuser)
- 🎫 Système de tickets (bouton **Ouvrir un ticket** → salon privé → bouton **Fermer**)
- 📁 Création/suppression rapide de salons : `/salon creer`, `/salon supprimer`
- 📢 Annonces en embed : `/annonce` **ou** en écrivant directement dans `#annonces` (le message est republié par le bot sous sa propre identité, dans le style "Voici les liens utiles du SDIS France.")
- 🧾 Logs serveur détaillés (arrivées/départs, actions de modération, changements de rôles, candidatures) dans `#server-logs` et `#mod-logs`
- `/aide` — liste toutes les commandes

Architecture pensée pour être étendue facilement (invite-tracking, giveaways, connexion à la base de données du jeu, etc.) au fur et à mesure que tu supprimes les autres bots.

## ⚠️ Important : ce code n'a pas pu être testé ici

Ce bot a été écrit dans un environnement cloud qui **ne peut pas se connecter à Discord** (le réseau ne supporte pas les WebSocket, et le registre npm est bloqué). Il faut donc le tester **sur ton PC** ou directement sur ton futur VPS avant de le mettre en production. La syntaxe de tous les fichiers a été vérifiée (`node --check`), mais un test réel reste indispensable.

## Installation (sur ton PC ou ton VPS)

1. Installe [Node.js](https://nodejs.org/) version 18 ou plus récente.
2. Récupère le dossier `pc-secours-bot` (copie tous les fichiers).
3. Ouvre un terminal dans ce dossier et installe les dépendances :
   ```bash
   npm install
   ```
4. Le fichier `.env` existe déjà avec ton token, ton `CLIENT_ID` et ton `GUILD_ID`. S'il manque, recopie `.env.example` en `.env` et remplis-le.

   ⚠️ **Recommandation sécurité** : ce token a transité par cette conversation. Avant de mettre le bot en production, régénère-le dans le [Discord Developer Portal](https://discord.com/developers/applications) → ton application → Bot → **Reset Token**, puis mets à jour `.env` avec le nouveau token.

5. Déploie les commandes slash sur ton serveur (à refaire à chaque ajout/modif de commande) :
   ```bash
   npm run deploy
   ```
6. Lance le bot :
   ```bash
   npm start
   ```
   Tu dois voir dans le terminal : `✅ Connecté en tant que PC Secours Admin#...`

## ⚙️ Configuration à vérifier avant de lancer

Ouvre `config.js` et vérifie que les noms correspondent **exactement** à ceux de ton serveur (rôles et salons) :

| Élément | Valeur par défaut | À faire |
|---|---|---|
| Rôle de base | `ARM` | doit déjà exister (créé précédemment) |
| Rôle admin | `COMMANDEMENT` | doit déjà exister |
| Rôles de service | `Police`, `Gendarmerie`, `Pompier`, `SAMU 112` | ne pas renommer sans mettre à jour `config.js` |
| Salon candidatures | `candidatures-opérateur` | crée ce salon si besoin, ou renomme dans `config.js` |
| Salon mod-logs | `mod-logs` | idem |
| Salon server-logs | `server-logs` | idem |
| Salon annonces (relais embed) | `annonces` | crée ce salon (visible uniquement par COMMANDEMENT en écriture si tu veux) |
| Catégorie tickets | `TICKETS` | crée cette catégorie |
| Salon panneau tickets | `support` | crée ce salon |
| Rôle Opérateur | `Opérateur` | crée ce rôle si besoin |

Si un nom ne correspond pas exactement (majuscules/accents compris pour les rôles), le bot enverra un message d'erreur clair au lieu de planter.

## Permissions du bot sur le serveur

Le bot a déjà été invité avec un jeu de permissions précis (pas Administrateur) :
Gérer le serveur, Gérer les rôles, Gérer les salons, Voir les salons, Expulser/Bannir/Modérer des membres, Gérer les pseudos, envoyer des messages/threads/réactions, utiliser les slash commands, gérer les webhooks.

⚠️ Pour que `/role commandement` et `/mod` fonctionnent, le **rôle du bot doit être placé au-dessus** du rôle `COMMANDEMENT` et des rôles de service dans la hiérarchie des rôles du serveur (Paramètres du serveur → Rôles), sinon Discord refusera certaines actions.

## Premières actions à faire une fois le bot lancé

1. `/ticket panneau` dans le salon `#support` → poste le bouton d'ouverture de ticket.
2. `/candidature panneau` dans `#candidatures-opérateur` → poste le bouton de candidature.
3. `/annonce titre:"Voici les liens utiles du SDIS France." message:"- Lien 1\n- Lien 2\n- Lien 3"` pour tester le format d'annonce.
4. Écris un message test dans `#annonces` pour vérifier le relais automatique en embed.

## Étapes suivantes (plus tard)

- Une fois que tu es content du fonctionnement, tu pourras retirer les autres bots un par un du serveur (rôles → permissions → kick du bot) en gardant celui-ci comme seul bot.
- Connexion au jeu (Supabase) pour des commandes du type `/credits donner <joueur> <montant>` : à faire quand tu auras les détails de la base de données du jeu (structure des tables joueurs/crédits).
- Ajout possible plus tard : invite-tracking, giveaways, anti-raid, etc. — l'architecture (`commands/`, `events/`, `handlers/`) est prévue pour ça, il suffit d'ajouter un fichier dans le bon dossier.

## Structure du projet

```
pc-secours-bot/
├── index.js                 # point d'entrée
├── deploy-commands.js        # enregistre les slash commands
├── config.js                 # ⚙️ toute la config (rôles, salons, couleurs)
├── .env                       # token & IDs (ne jamais partager/committer)
├── commands/                  # une commande slash par fichier
├── events/                    # un événement Discord par fichier
├── handlers/                  # chargement automatique des commands/events
├── utils/                      # fonctions réutilisables (embeds, logs, résolution rôle/salon)
└── data/                       # stockage local (avertissements, compteur de tickets)
```
