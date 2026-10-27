// L'assistant (section #assistant) : un iPhone en vraie 3D (même modèle que recit3d.js),
// dont l'écran reproduit l'assistant de l'app, dessiné en direct dans un canvas.
//
// On touche une demande à gauche : elle s'écrit dans la barre du bas, part en bulle, « Cosmo réfléchit… »,
// puis Cosmo répond avec sa carte (« À valider » quand quelque chose doit partir), comme dans l'app.
// Tant que personne ne touche, les demandes défilent toutes seules quand la section est à l'écran.
// Tout est écrit ici, avec des données d'exemple : rien ne part vers un serveur.
// Sans WebGL, le même écran s'affiche à plat.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const boite = document.querySelector("[data-ia3d]");
const zone = document.querySelector("[data-ia-demandes]");
const annonce = document.querySelector("[data-ia-annonce]");

// ---------- Les demandes et les réponses (données d'exemple) ----------
const DEMANDES = [
  { court: "Faire un devis", texte: "Fais un devis à Julie Petit pour sa cuisine : 28 m² de murs.",
    reponse: "Voici le devis pour Julie Petit : 800,80 € TTC. Relisez, puis validez.",
    carte: { titre: "Devis pour Julie Petit", badge: "À valider", lignes: [["Client", "Julie Petit"], ["Objet", "Peinture cuisine"], ["Murs, deux couches · 28 m²", "728,00 €"]],
      total: { gauche: ["728,00 € HT", "TVA 72,80 €"], valeur: "800,80 €", unite: "TTC" }, deux: true, principal: "Créer le devis" } },
  { court: "Ce que j'ai encaissé", texte: "Combien j'ai encaissé ce mois-ci ?",
    reponse: "En octobre, vous avez encaissé 18 450 €. Deux factures sont en retard.",
    carte: { titre: "Octobre 2026", lignes: [["Encaissé", "18 450 €", "vert"], ["Facturé", "22 300 €"], ["En retard", "1 250 €", "orange"], ["Devis en attente", "4 800 €"]] } },
  { court: "Relancer les impayés", texte: "Relance toutes les factures en retard.",
    reponse: "J'ai préparé 2 relances par e-mail. Relisez-les, puis validez pour les envoyer.",
    carte: { titre: "Relances par e-mail", badge: "À valider", lignes: [["F-2026-0042 · M. Martin", "850,00 €"], ["F-2026-0038 · SCI Les Tilleuls", "400,00 €"]], deux: true, principal: "Envoyer les 2 relances" } },
  { court: "La TVA du mois", texte: "Quelle TVA je dois payer ce mois-ci ?",
    reponse: "Pour octobre, vous devez 2 310 € de TVA. La déclaration est prête.",
    carte: { titre: "TVA d'octobre", lignes: [["TVA collectée", "4 210 €"], ["TVA déductible", "1 900 €"]], total: { gauche: ["Déclaration prête"], valeur: "2 310 €", unite: "à payer" } } },
  { court: "Un virement arrivé ?", texte: "Le virement de Julie Petit est arrivé ?",
    reponse: "Oui, 1 196,80 € reçus hier sur votre compte. Je marque la facture comme payée ?",
    carte: { titre: "Banque connectée", badge: "À valider", lignes: [["Virement Julie Petit · 26 oct.", "+1 196,80 €", "vert"], ["Facture F-2026-0041", "1 196,80 €"]], principal: "Marquer comme payée" } },
  { court: "Prendre un rendez-vous", texte: "Ajoute un rendez-vous chez M. Martin jeudi à 9 h.",
    reponse: "C'est noté : jeudi 29 octobre à 9 h, chez M. Martin.",
    carte: { titre: "Rendez-vous ajouté", badge: "Fait", lignes: [["Quand", "Jeudi 29 oct. · 9:00"], ["Avec", "M. Martin"], ["Où", "12 rue des Lilas, Lyon"]] } },
  { court: "Une facture fournisseur", texte: "J'ai reçu une facture de Point P de 480 € TTC, à payer fin novembre.",
    reponse: "J'ai préparé la facture d'achat de Point P. Vérifiez, puis validez pour l'enregistrer.",
    carte: { titre: "Facture d'achat · Point P", badge: "À valider", lignes: [["Fournisseur", "Point P"], ["À payer le", "30 novembre"]],
      total: { gauche: ["400,00 € HT", "TVA 80,00 €"], valeur: "480,00 €", unite: "TTC" }, deux: true, principal: "Enregistrer l'achat" } },
  { court: "Envoyer au comptable", texte: "Envoie la compta à mon comptable.",
    reponse: "J'ai préparé l'e-mail pour votre comptable, avec le FEC, les écritures et la balance.",
    carte: { titre: "E-mail au comptable", badge: "À valider", lignes: [["À", "Cabinet Morel"], ["Période", "Exercice 2026"], ["Pièces jointes", "FEC, écritures, balance"]], deux: true, principal: "Envoyer" } }
];

// ---------- L'écran : dessiné en points iPhone (402 × 874), deux pixels par point ----------
const W = 402, H = 874, K = 2;
const POLICE = '-apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
const ORANGE = "#FF4F12", ENCRE = "#1D1D1F", GRIS = "#8A8A8E";

const toile = document.createElement("canvas");
toile.width = W * K;
toile.height = H * K;
const g = toile.getContext("2d");
g.scale(K, K);

const borne = function (x) { return Math.min(1, Math.max(0, x)); };
const sortie = function (x) { return 1 - Math.pow(1 - x, 3); };
const police = function (taille, graisse) { g.font = (graisse || 400) + " " + taille + "px " + POLICE; };
const rond = function (x, y, l, h, r) { g.beginPath(); g.roundRect(x, y, l, h, r); };
// coupe un texte en lignes qui tiennent dans « largeur »
const couper = function (texte, largeur) {
  const mots = texte.split(" "), lignes = [];
  let l = "";
  mots.forEach(function (m) {
    const essai = l ? l + " " + m : m;
    if (g.measureText(essai).width > largeur && l) { lignes.push(l); l = m; } else l = essai;
  });
  if (l) lignes.push(l);
  return lignes;
};

// le fond de l'app (dégradé pêche, rose, lavande), dessiné une fois
const fond = document.createElement("canvas");
fond.width = W * K; fond.height = H * K;
(function () {
  const f = fond.getContext("2d");
  f.scale(K, K);
  f.fillStyle = "#FBFAFF"; f.fillRect(0, 0, W, H);
  [[0, H, 460, "rgba(255, 186, 150, .85)"], [W, H * 0.95, 420, "rgba(170, 196, 255, .8)"], [W * 0.45, H * 0.82, 300, "rgba(255, 196, 232, .7)"], [W * 0.6, 120, 260, "rgba(214, 206, 255, .35)"]]
    .forEach(function (t) {
      const r = f.createRadialGradient(t[0], t[1], 0, t[0], t[1], t[2]);
      r.addColorStop(0, t[3]); r.addColorStop(1, "rgba(255, 255, 255, 0)");
      f.fillStyle = r; f.fillRect(0, 0, W, H);
    });
})();

// l'orbe de Cosmo : anneau coloré, disque noir, le C blanc et son point orange
function orbe(x, y, r, s) {
  g.save();
  g.shadowColor = "rgba(255, 90, 31, .45)"; g.shadowBlur = r * 0.9;
  const anneau = g.createConicGradient ? g.createConicGradient(s * 0.8, x, y) : g.createLinearGradient(x - r, y, x + r, y);
  anneau.addColorStop(0, "#FF5A1F"); anneau.addColorStop(0.3, "#FF3D8B"); anneau.addColorStop(0.55, "#8B5CF6");
  anneau.addColorStop(0.8, "#3B82F6"); anneau.addColorStop(1, "#FF5A1F");
  g.fillStyle = anneau; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.restore();
  const disque = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r * 0.82);
  disque.addColorStop(0, "#3A3A40"); disque.addColorStop(1, "#111114");
  g.fillStyle = disque; g.beginPath(); g.arc(x, y, r * 0.8, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#fff"; g.lineWidth = r * 0.24; g.lineCap = "round";
  g.beginPath(); g.arc(x, y, r * 0.4, Math.PI * 0.27, Math.PI * 1.73); g.stroke();
  g.fillStyle = ORANGE; g.beginPath();
  g.arc(x + Math.cos(Math.PI * 0.27) * r * 0.4, y + Math.sin(Math.PI * 0.27) * r * 0.4, r * 0.15, 0, Math.PI * 2); g.fill();
}

// un bouton rond en verre de l'en-tête
function boutonRond(x, y, dessin) {
  g.save();
  g.shadowColor = "rgba(40, 30, 90, .12)"; g.shadowBlur = 10; g.shadowOffsetY = 3;
  g.fillStyle = "rgba(255, 255, 255, .9)"; g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.fill();
  g.restore();
  g.strokeStyle = "rgba(0, 0, 0, .06)"; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = ENCRE; g.lineWidth = 2.2; g.lineCap = "round"; g.lineJoin = "round";
  dessin();
}

function barreHaut() {
  police(17, 600); g.fillStyle = ENCRE; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("9:41", 62, 31);
  g.fillStyle = "#000"; rond(136, 12, 130, 38, 19); g.fill();
  // réseau, wifi, batterie
  g.fillStyle = ENCRE;
  [0, 1, 2, 3].forEach(function (k) { rond(296 + k * 6, 36 - 4 - k * 3, 4, 4 + k * 3, 1); g.fill(); });
  g.strokeStyle = ENCRE; g.lineWidth = 2; g.lineCap = "round";
  [5, 9, 13].forEach(function (r) { g.beginPath(); g.arc(333, 37, r, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); });
  g.lineWidth = 1.2; g.globalAlpha = 0.45; rond(350, 25, 26, 13, 4); g.stroke(); g.globalAlpha = 1;
  rond(352, 27, 22, 9, 2.5); g.fill();
}

function enTete(s) {
  boutonRond(38, 92, function () { g.beginPath(); g.moveTo(32, 86); g.lineTo(44, 98); g.moveTo(44, 86); g.lineTo(32, 98); g.stroke(); });
  boutonRond(310, 92, function () {
    g.beginPath(); g.arc(310, 92, 8, Math.PI * 1.15, Math.PI * 0.95); g.stroke();
    g.beginPath(); g.moveTo(310, 87); g.lineTo(310, 92); g.lineTo(314, 95); g.stroke();
  });
  boutonRond(364, 92, function () {
    rond(356, 85, 15, 15, 3.5); g.stroke();
    g.beginPath(); g.moveTo(362, 92); g.lineTo(370, 84); g.stroke();
  });
  orbe(170, 92, 14, s);
  police(21, 700); g.fillStyle = ENCRE; g.textAlign = "left"; g.fillText("Cosmo", 191, 93);
}

// la barre « Demandez à Cosmo… » et son micro orange
function saisie(texte, curseur) {
  g.save();
  g.shadowColor = "rgba(40, 30, 90, .12)"; g.shadowBlur = 16; g.shadowOffsetY = 4;
  g.fillStyle = "rgba(255, 255, 255, .78)"; rond(16, 790, 318, 52, 26); g.fill();
  g.restore();
  g.strokeStyle = "rgba(255, 255, 255, .9)"; g.lineWidth = 1; rond(16, 790, 318, 52, 26); g.stroke();
  police(17); g.textAlign = "left"; g.textBaseline = "middle";
  if (texte) {
    // le texte qui s'écrit : on garde la fin visible
    let t = texte;
    while (g.measureText(t).width > 280 && t.length > 4) t = t.slice(1);
    if (t !== texte) t = "…" + t.slice(1);
    g.fillStyle = ENCRE; g.fillText(t, 34, 817);
    if (curseur) { g.fillStyle = ORANGE; g.fillRect(34 + g.measureText(t).width + 2, 805, 2, 24); }
  } else {
    g.fillStyle = "#9A98A3"; g.fillText("Demandez à Cosmo…", 34, 817);
  }
  g.save();
  g.shadowColor = "rgba(255, 79, 18, .45)"; g.shadowBlur = 14; g.shadowOffsetY = 4;
  g.fillStyle = ORANGE; g.beginPath(); g.arc(366, 816, 27, 0, Math.PI * 2); g.fill();
  g.restore();
  g.strokeStyle = "#fff"; g.lineWidth = 2.2; g.lineCap = "round";
  rond(361, 803, 10, 16, 5); g.stroke();
  g.beginPath(); g.arc(366, 815, 8.5, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
  g.beginPath(); g.moveTo(366, 824); g.lineTo(366, 829); g.stroke();
}

// ---------- Les éléments de la conversation : chacun sait se mesurer et se dessiner ----------
function bulleMoi(texte) {
  police(17);
  const lignes = couper(texte, 270);
  const l = Math.max.apply(null, lignes.map(function (x) { return g.measureText(x).width; })) + 34;
  const h = lignes.length * 22 + 24;
  return { h: h, dessiner: function (y) {
    g.fillStyle = "#FFDCD1"; rond(W - 16 - l, y, l, h, 22); g.fill();
    police(17); g.fillStyle = ENCRE; g.textAlign = "left"; g.textBaseline = "middle";
    lignes.forEach(function (x, k) { g.fillText(x, W - 16 - l + 17, y + 23 + k * 22); });
  } };
}

function reflexion(s) {
  return { h: 76, dessiner: function (y) {
    g.save(); g.shadowColor = "rgba(40, 30, 90, .1)"; g.shadowBlur = 14; g.shadowOffsetY = 3;
    g.fillStyle = "rgba(255, 255, 255, .88)"; rond(16, y, 236, 76, 24); g.fill(); g.restore();
    g.strokeStyle = "rgba(0, 0, 0, .05)"; g.lineWidth = 1; rond(16, y, 236, 76, 24); g.stroke();
    orbe(52, y + 38, 22, s);
    police(17, 600); g.fillStyle = ENCRE; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText("Cosmo réfléchit…", 86, y + 30);
    [0, 1, 2].forEach(function (k) {
      g.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(s * 6 - k * 0.9));
      g.fillStyle = "#FF9C7A"; g.beginPath(); g.arc(92 + k * 13, y + 52, 4, 0, Math.PI * 2); g.fill();
    });
    g.globalAlpha = 1;
  } };
}

function bulleCosmo(texte, s) {
  police(17);
  const lignes = couper(texte, 268);
  const l = Math.max.apply(null, lignes.map(function (x) { return g.measureText(x).width; })) + 34;
  const h = lignes.length * 22 + 24;
  return { h: h, dessiner: function (y) {
    orbe(32, y + 18, 15, s);
    g.fillStyle = "rgba(255, 255, 255, .92)"; rond(58, y, l, h, 22); g.fill();
    g.strokeStyle = "rgba(0, 0, 0, .06)"; g.lineWidth = 1; rond(58, y, l, h, 22); g.stroke();
    police(17); g.fillStyle = ENCRE; g.textAlign = "left"; g.textBaseline = "middle";
    lignes.forEach(function (x, k) { g.fillText(x, 75, y + 23 + k * 22); });
  } };
}

function carte(c) {
  const h = 18 + 30 + 8 + c.lignes.length * 40 + (c.total ? 74 : 0) + (c.deux ? 62 : 0) + (c.principal ? 66 : 0) + 8;
  return { h: h, dessiner: function (y) {
    const x = 16, l = W - 32;
    g.save(); g.shadowColor = "rgba(255, 90, 31, .14)"; g.shadowBlur = 22; g.shadowOffsetY = 6;
    g.fillStyle = "rgba(255, 255, 255, .95)"; rond(x, y, l, h, 26); g.fill(); g.restore();
    g.strokeStyle = c.badge === "À valider" ? "#FFC6B2" : "rgba(0, 0, 0, .07)"; g.lineWidth = 1.5; rond(x, y, l, h, 26); g.stroke();
    // titre, avec la petite icône de document et le badge
    let yy = y + 18 + 15;
    g.strokeStyle = ORANGE; g.lineWidth = 2; g.lineJoin = "round";
    rond(x + 18, yy - 11, 17, 21, 3); g.stroke();
    g.beginPath(); g.moveTo(x + 22, yy - 2); g.lineTo(x + 31, yy - 2); g.moveTo(x + 22, yy + 4); g.lineTo(x + 29, yy + 4); g.stroke();
    police(18, 700); g.fillStyle = ENCRE; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(c.titre, x + 46, yy);
    if (c.badge) {
      police(13, 600);
      const lb = g.measureText(c.badge).width + 20;
      const fait = c.badge === "Fait";
      g.fillStyle = fait ? "#E3F6E8" : "#FFE6DC"; rond(x + l - 18 - lb, yy - 13, lb, 26, 13); g.fill();
      g.fillStyle = fait ? "#1B7F3B" : "#E8541E"; g.textAlign = "center"; g.fillText(c.badge, x + l - 18 - lb / 2, yy + 1);
    }
    yy += 23;
    // les lignes : libellé à gauche, valeur à droite
    c.lignes.forEach(function (li) {
      g.strokeStyle = "rgba(0, 0, 0, .07)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 18, yy); g.lineTo(x + l - 18, yy); g.stroke();
      police(15.5); g.fillStyle = GRIS; g.textAlign = "left"; g.fillText(li[0], x + 18, yy + 20);
      police(15.5, 600); g.fillStyle = li[2] === "vert" ? "#1B7F3B" : li[2] === "orange" ? "#E8541E" : ENCRE;
      g.textAlign = "right"; g.fillText(li[1], x + l - 18, yy + 20);
      yy += 40;
    });
    if (c.total) {
      g.strokeStyle = "rgba(0, 0, 0, .07)"; g.beginPath(); g.moveTo(x + 18, yy); g.lineTo(x + l - 18, yy); g.stroke();
      police(13.5); g.fillStyle = GRIS; g.textAlign = "left";
      c.total.gauche.forEach(function (t, k) { g.fillText(t, x + 18, yy + 26 + k * 19); });
      police(28, 800); g.fillStyle = ENCRE; g.textAlign = "right"; g.fillText(c.total.valeur, x + l - 18, yy + 30);
      police(12.5, 600); g.fillStyle = GRIS; g.fillText(c.total.unite, x + l - 18, yy + 54);
      yy += 74;
    }
    if (c.deux) {
      [["Annuler", x + 18], ["Modifier", x + 18 + (l - 46) / 2 + 10]].forEach(function (b) {
        const lb = (l - 46) / 2;
        g.fillStyle = "rgba(255, 255, 255, .9)"; rond(b[1], yy + 4, lb, 50, 25); g.fill();
        g.strokeStyle = "rgba(0, 0, 0, .08)"; g.lineWidth = 1; rond(b[1], yy + 4, lb, 50, 25); g.stroke();
        police(17, 500); g.fillStyle = "#E8541E"; g.textAlign = "center"; g.fillText(b[0], b[1] + lb / 2, yy + 29);
      });
      yy += 62;
    }
    if (c.principal) {
      g.save(); g.shadowColor = "rgba(255, 79, 18, .35)"; g.shadowBlur = 14; g.shadowOffsetY = 4;
      const d = g.createLinearGradient(0, yy + 4, 0, yy + 58);
      d.addColorStop(0, "#FF6A33"); d.addColorStop(1, ORANGE);
      g.fillStyle = d; rond(x + 18, yy + 4, l - 36, 54, 27); g.fill(); g.restore();
      police(17, 600); g.fillStyle = "#fff"; g.textAlign = "center";
      g.fillText("✓  " + c.principal, x + l / 2, yy + 31);
    }
  } };
}

// ---------- La scène : tout se calcule à partir du temps écoulé depuis la demande ----------
let courant = -1, precedent = -1, debut = 0, finPrecedent = 0;

function plan(i, t, s) {
  // renvoie les éléments visibles de la demande i, t secondes après son départ
  const d = DEMANDES[i];
  const tEcrit = 0.3, vitesse = 42;
  const tEnvoi = tEcrit + d.texte.length / vitesse + 0.35;
  const tReflexion = tEnvoi + 0.35, tReponse = tReflexion + 1.25, tCarte = tReponse + 0.35;
  const els = [];
  let tape = "";
  if (t >= tEcrit && t < tEnvoi) tape = d.texte.slice(0, Math.ceil((t - tEcrit) * vitesse));
  if (t >= tEnvoi) els.push({ el: bulleMoi(d.texte), t0: tEnvoi });
  if (t >= tReflexion && t < tReponse) els.push({ el: reflexion(s), t0: tReflexion });
  if (t >= tReponse) els.push({ el: bulleCosmo(d.reponse, s), t0: tReponse });
  if (t >= tCarte) els.push({ el: carte(d.carte), t0: tCarte });
  return { els: els, tape: tape, fini: tCarte + 4.6, tReponse: tReponse };
}

function dessinerConversation(i, t, s, alpha) {
  const p = plan(i, t, s);
  // on empile du haut vers le bas ; si ça déborde, tout remonte (comme un fil de discussion)
  let total = 0;
  p.els.forEach(function (e) { total += e.el.h + 14; });
  const haut = 128, bas = 776;
  const decalage = Math.max(0, haut + total - bas);
  g.save();
  g.beginPath(); g.rect(0, 112, W, bas - 104); g.clip();
  let y = haut - decalage;
  p.els.forEach(function (e) {
    const a = sortie(borne((t - e.t0) / 0.45));
    g.globalAlpha = alpha * Math.min(1, a * 1.5);
    g.save(); g.translate(0, (1 - a) * 16);
    e.el.dessiner(y);
    g.restore();
    y += e.el.h + 14;
  });
  g.restore();
  g.globalAlpha = 1;
  return p;
}

function dessinerAccueil(s, alpha) {
  g.globalAlpha = alpha;
  orbe(W / 2, 300, 74 + Math.sin(s * 1.6) * 2, s);
  police(26, 700); g.fillStyle = ENCRE; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("Bonjour Sophie.", W / 2, 420);
  police(18); g.fillStyle = GRIS; g.fillText("Que puis-je faire pour vous ?", W / 2, 452);
  g.globalAlpha = 1;
}

function dessiner(maintenant) {
  const s = maintenant / 1000;
  g.drawImage(fond, 0, 0, W, H);
  barreHaut();
  enTete(s);
  let tape = "";
  if (courant < 0) {
    dessinerAccueil(s, 1);
  } else {
    const t = s - debut;
    // l'écran précédent s'efface pendant que la nouvelle demande commence à s'écrire
    const x = borne(t / 0.25);
    if (precedent >= 0 && x < 1) dessinerConversation(precedent, finPrecedent, s, 1 - x);
    else if (precedent < 0 && x < 1) dessinerAccueil(s, 1 - x);
    const p = dessinerConversation(courant, t, s, 1);
    tape = p.tape;
    if (!annonce.dataset.fait && t >= p.tReponse) { annonce.textContent = DEMANDES[courant].reponse; annonce.dataset.fait = "1"; }
    if (t >= p.fini && !manuel && visible) jouer((courant + 1) % DEMANDES.length);
  }
  saisie(tape, tape && Math.floor(s * 2.4) % 2 === 0);
}

let manuel = false, visible = false;
let boutons = [];
function jouer(i) {
  const s = performance.now() / 1000;
  if (courant >= 0) { precedent = courant; finPrecedent = Math.min(s - debut, plan(courant, 1e3, 0).fini); }
  courant = i;
  debut = s;
  annonce.textContent = ""; delete annonce.dataset.fait;
  boutons.forEach(function (b, k) { b.classList.toggle("actif", k === i); b.setAttribute("aria-pressed", k === i ? "true" : "false"); });
}

// ---------- La mise en route : boutons, iPhone 3D, boucle ----------
function demarrer() {
  boutons = DEMANDES.map(function (d, i) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ia-demande";
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = "<b></b><small></small>";
    b.querySelector("b").textContent = d.court;
    b.querySelector("small").textContent = "« " + d.texte + " »";
    b.addEventListener("click", function () { manuel = true; jouer(i); });
    zone.appendChild(b);
    return b;
  });

  let rendu = null;
  try {
    rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { rendu = null; }

  if (!rendu) {
    // sans WebGL : l'écran à plat, dans un cadre arrondi
    boite.classList.add("sans-3d");
    boite.appendChild(toile);
    lancerBoucle(function (m) { dessiner(m); });
    return;
  }

  rendu.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  rendu.outputColorSpace = THREE.SRGBColorSpace;
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 1.05;
  boite.appendChild(rendu.domElement);

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(rendu).fromScene(new RoomEnvironment(), 0.04).texture;
  const lumiere = new THREE.DirectionalLight(0xffffff, 1.4);
  lumiere.position.set(2, 3, 4);
  scene.add(lumiere);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 10);
  const pivot = new THREE.Group();
  scene.add(pivot);

  const texture = new THREE.CanvasTexture(toile);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.anisotropy = rendu.capabilities.getMaxAnisotropy();
  const ecran = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });

  let hauteur = 1, pret = false;
  const cadrer = function () {
    const l = boite.clientWidth, h = boite.clientHeight;
    if (!l || !h) return;
    rendu.setSize(l, h, false);
    camera.aspect = l / h;
    const d = (hauteur / 0.92) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", cadrer);

  const draco = new DRACOLoader();
  draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
  const chargeur = new GLTFLoader();
  chargeur.setDRACOLoader(draco);
  chargeur.load("modeles/iphone-15-pro.glb", function (gltf) {
    const modele = gltf.scene;
    modele.traverse(function (o) {
      if (!o.isMesh) return;
      // le logo Apple au dos est une marque déposée : on le retire
      if (o.name === "IykfmVvLplTsTEW" || o.name === "WJwwVjsahIXbJpU") o.visible = false;
      if (o.material && o.material.name === "pIJKfZsazmcpEiU") o.material = ecran;
    });
    const b = new THREE.Box3().setFromObject(modele);
    modele.position.sub(b.getCenter(new THREE.Vector3()));
    hauteur = b.getSize(new THREE.Vector3()).y;
    pivot.add(modele);
    pret = true;
    boite.classList.add("pret");
    cadrer();
  }, undefined, function () {
    // modèle introuvable : l'écran à plat
    rendu.domElement.remove();
    boite.classList.add("sans-3d");
    boite.appendChild(toile);
  });

  // l'iPhone reste immobile, légèrement tourné : seul son écran bouge
  lancerBoucle(function (m) {
    dessiner(m);
    texture.needsUpdate = true;
    if (!pret) return;
    pivot.rotation.set(0.03, Math.PI - 0.16, -0.015);
    rendu.render(scene, camera);
  });
}

// une seule boucle, qui ne tourne que quand la section est à l'écran
function lancerBoucle(image) {
  let attente = null;
  const tour = function (m) { if (!visible) { attente = null; return; } image(m); attente = requestAnimationFrame(tour); };
  new IntersectionObserver(function (e) {
    const avant = visible;
    visible = e[0].isIntersecting;
    if (visible && !avant) {
      if (!manuel) jouer(courant < 0 ? 0 : (courant + 1) % DEMANDES.length);
      if (!attente) attente = requestAnimationFrame(tour);
    }
  }, { threshold: 0.35 }).observe(boite);
}

if (boite && zone && annonce) demarrer();
