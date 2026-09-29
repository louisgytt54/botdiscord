// ============================================================================
// utils/welcomeCard.js — génère une image "carte régulateur" (arrivée/départ),
// façon console de régulation (thème du bot : PC Secours | Régulation
// 15-17-18-112), postée dans le salon config.channels.regulateurWelcome.
//
// Nécessite la dépendance "@napi-rs/canvas" (voir package.json — installe-la
// avec `npm install` après avoir récupéré ces fichiers).
// Les polices utilisées (Poppins, licence SIL Open Font License) sont
// embarquées dans assets/fonts/ pour un rendu identique quel que soit
// l'hébergeur (certains serveurs n'ont aucune police système installée).
// ============================================================================

const path = require("path");
const { createCanvas, GlobalFonts, loadImage } = require("@napi-rs/canvas");
const config = require("../config");

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  const dir = path.join(__dirname, "..", "assets", "fonts");
  try {
    GlobalFonts.registerFromPath(path.join(dir, "Poppins-Bold.ttf"), "Poppins Bold");
    GlobalFonts.registerFromPath(path.join(dir, "Poppins-Medium.ttf"), "Poppins Medium");
    GlobalFonts.registerFromPath(path.join(dir, "Poppins-Regular.ttf"), "Poppins Regular");
  } catch (err) {
    console.error("[welcomeCard] Impossible de charger les polices Poppins :", err.message);
  }
  fontsRegistered = true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(str, max) {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

// Ajoute un espacement fin entre les lettres pour un rendu "label" façon HUD.
function spaced(str) {
  return str.split("").join("  ");
}

function hexToCss(num) {
  return `#${num.toString(16).padStart(6, "0")}`;
}

/**
 * @param {{ member: import('discord.js').GuildMember, type: "join"|"leave" }} params
 * @returns {Promise<Buffer>} PNG
 */
async function generateWelcomeCard({ member, type }) {
  ensureFonts();

  const isJoin = type === "join";
  const accent = isJoin ? "#2ecc71" : hexToCss(config.branding.colorDanger || 0xe74c3c);

  const W = 900;
  const H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // --- Fond : coins arrondis + dégradé sombre diagonal ---------------------
  roundRect(ctx, 0, 0, W, H, 26);
  ctx.clip();

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0e14");
  bg.addColorStop(1, "#161b28");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Grille fine façon "console de régulation".
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Lueur douce derrière l'avatar.
  const glow = ctx.createRadialGradient(170, H / 2, 10, 170, H / 2, 170);
  glow.addColorStop(0, `${accent}55`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 340, H);

  // Barre d'accent verticale à gauche.
  ctx.fillStyle = accent;
  roundRect(ctx, 0, 0, 8, H, 4);
  ctx.fill();

  // --- Avatar circulaire avec anneau lumineux -------------------------------
  let avatarImg = null;
  try {
    const avatarURL = member.user.displayAvatarURL({ extension: "png", size: 256 });
    const res = await fetch(avatarURL);
    const buf = Buffer.from(await res.arrayBuffer());
    avatarImg = await loadImage(buf);
  } catch (err) {
    console.error("[welcomeCard] Impossible de charger l'avatar :", err.message);
  }

  const cx = 170;
  const cy = H / 2;
  const r = 82;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.shadowColor = accent;
  ctx.shadowBlur = 25;
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = "#2c3345";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();

  // Pastille de statut (en ligne / hors ligne).
  const dotOffset = r * Math.cos(Math.PI / 4);
  const dotX = cx + dotOffset;
  const dotY = cy + dotOffset;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 20, 0, Math.PI * 2);
  ctx.fillStyle = "#0b0e14";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dotX, dotY, 15, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();

  // --- Colonne de texte ------------------------------------------------------
  const textX = 320;

  // Pastille de label ("NOUVELLE CONNEXION" / "DÉCONNEXION").
  const label = isJoin ? "NOUVELLE CONNEXION" : "DÉCONNEXION";
  const labelText = spaced(label);
  ctx.font = "600 18px Poppins Medium";
  const labelWidth = ctx.measureText(labelText).width;
  const pillY = 46;
  const pillH = 38;
  roundRect(ctx, textX, pillY, labelWidth + 32, pillH, pillH / 2);
  ctx.fillStyle = `${accent}22`;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.textBaseline = "middle";
  ctx.fillText(labelText, textX + 16, pillY + pillH / 2 + 1);
  ctx.textBaseline = "alphabetic";

  // Titre : pseudo du membre.
  ctx.font = "700 44px Poppins Bold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(truncate(member.user.username, 22), textX, 150);

  // Sous-titre.
  ctx.font = "400 21px Poppins Regular";
  ctx.fillStyle = "#aab2c5";
  const sub = isJoin
    ? "vient de rejoindre l'effectif de régulation."
    : "quitte l'effectif de régulation.";
  ctx.fillText(sub, textX, 182);

  // Séparateur.
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(textX, 210);
  ctx.lineTo(W - 40, 210);
  ctx.stroke();

  // Pied : nom du serveur + effectif total.
  ctx.font = "600 19px Poppins Medium";
  ctx.fillStyle = "#e5e8ef";
  ctx.fillText(truncate(member.guild.name, 42), textX, 245);

  const count = member.guild.memberCount || 0;
  ctx.font = "400 17px Poppins Regular";
  ctx.fillStyle = "#7d8496";
  ctx.fillText(`${count} régulateur${count > 1 ? "s" : ""} au total`, textX, 271);

  return canvas.encode("png");
}

module.exports = { generateWelcomeCard };
