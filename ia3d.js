// L'assistant (section #assistant) : un iPhone en vraie 3D (même modèle que recit3d.js),
// dont l'écran reproduit la page de Cosmo de l'app (build 42, novembre 2026), dessinée en direct dans un canvas.
//
// Au repos : l'accueil de Cosmo (logo, « Bonjour Sophie », ce qui attend un accord, des exemples, la barre de saisie).
// On touche une demande à gauche : elle s'écrit dans la barre, monte en bulle grise à droite pendant que l'accueil
// s'efface, « Cosmo réfléchit… », la réponse s'écrit mot à mot (texte libre, sans bulle), puis la carte arrive avec un
// léger ressort (« À valider » avec son bouton noir quand quelque chose doit partir ou s'enregistrer), et enfin les
// petites icônes copier / lire / partager. Tant que personne ne touche, les demandes défilent toutes seules quand la
// section est à l'écran.
// Tailles, couleurs, graisses et marges reprises du code SwiftUI de l'app (Views/Assistant, Design, thème « Minimaliste
// clair ») et vérifiées sur des captures réelles. Tout est écrit ici, avec des données d'exemple : rien ne part vers
// un serveur. Sans WebGL, le même écran s'affiche à plat.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const boite = document.querySelector("[data-ia3d]");
const zone = document.querySelector("[data-ia-demandes]");
const annonce = document.querySelector("[data-ia-annonce]");

// ---------- Les demandes et les réponses (données d'exemple : Sophie, peintre, mardi 10 novembre 2026) ----------
// Mêmes données que l'accueil : une seule facture en retard (F-2026-0009, Cabinet dentaire du Beffroi, 7 290 €,
// échue le jeudi 8 octobre) ; la facture F-2026-0010 de Julie Petit (1 196,80 €) attend son paiement.
// Les cartes reprennent celles de l'app : « valider » (titre, « À valider », lignes, e-mail, bouton noir, Modifier,
// Annuler), « chiffres » (le chiffre clé en grand), « liste » (lignes à icône ronde), « fait » (ce qui est déjà fait,
// avec « Annuler »), « piece » (la pièce et la vignette de son PDF), « suites » (capsules grises).
const RELANCE = "Bonjour,\n\nSauf erreur de notre part, la facture F-2026-0009 du mardi 8 septembre, d’un montant de 7 290,00 € TTC, arrivée à échéance le jeudi 8 octobre, n’a pas encore été réglée…";
const DEMANDES = [
  { court: "Faire un devis", texte: "Fais un devis à Julie Petit pour sa cuisine : 28 m² de murs.",
    reponse: "Le devis D-2026-0011 est prêt en brouillon : 800,80 € TTC. Rien n’est parti.",
    cartes: [
      { genre: "fait", texte: "Devis D-2026-0011 créé." },
      { genre: "piece", titre: "Devis D-2026-0011", sous: "Julie Petit · Peinture de la cuisine", montant: "800,80 €", etat: "Brouillon" },
      { genre: "suites", capsules: [["Envoyer", "avion"]] }
    ],
    questions: ["Quels devis attendent une réponse ?"] },
  { court: "Ce que j'ai encaissé", texte: "Combien j'ai encaissé ce mois-ci ?",
    reponse: "En novembre, vous avez encaissé 6 480 €. Il reste 8 487 € à encaisser, dont une facture en retard.",
    cartes: [{ genre: "chiffres", titre: "Novembre 2026", cle: ["Encaissé", "6 480 €"],
      lignes: [["Facturé HT", "9 350 €"], ["Reste à encaisser", "8 487 €", "2 factures, dont 1 en retard", true], ["Devis en attente", "5 200 €", "3 devis"]] }],
    liens: ["Relance les factures en retard"], questions: ["Quels devis attendent une réponse ?"] },
  { court: "Qui relancer ?", texte: "Qui dois-je relancer ?",
    reponse: "2 relances à faire : Cabinet dentaire du Beffroi (facture F-2026-0009, 7 290 €, en retard de 33 jours), M. Martin (devis D-2026-0008, 2 450 €, pas encore signé). Je prépare la première ?",
    cartes: [{ genre: "liste", lignes: [
      { icone: "docPlein", titre: "Facture F-2026-0009", sous: "Cabinet dentaire du Beffroi · 8 sept.", montant: "7 290,00 €", etat: "En retard", rouge: true },
      { icone: "doc", titre: "Devis D-2026-0008", sous: "M. Martin · Ravalement de façade · 21 oct.", montant: "2 450,00 €", etat: "Envoyé" }] }],
    liens: ["Relance les factures en retard"] },
  { court: "Relancer les impayés", texte: "Relance toutes les factures en retard.",
    reponse: "Une facture est en retard. Voici sa relance : validez pour l’envoyer.",
    cartes: [{ genre: "valider", titre: "Relance d’une facture en retard", icone: "cloche",
      lignes: [["Factures", "1 en retard"], ["Total dû", "7 290,00 € TTC"]],
      mail: { objet: "Rappel : facture F-2026-0009 — Atelier Couleurs Opale", corps: RELANCE },
      bouton: "Envoyer la relance", iconeBouton: "avion" }] },
  { court: "La TVA du mois", texte: "Quelle TVA je dois payer ce mois-ci ?",
    reponse: "Pour octobre, vous devez 1 284 € de TVA. Tout est prêt pour votre déclaration.",
    cartes: [{ genre: "chiffres", titre: "TVA d’octobre 2026", cle: ["TVA à payer", "1 284 €"],
      lignes: [["TVA collectée", "2 146 €", "Sur 10 730 € facturés HT"], ["TVA déductible", "862 €", "Sur vos achats du mois"]] }],
    questions: ["Quel est mon résultat ?"] },
  { court: "Un virement arrivé ?", texte: "Le virement de Julie Petit est arrivé ?",
    reponse: "Oui, 1 196,80 € reçus hier sur votre compte. La facture F-2026-0010 passe en payée dès que vous validez.",
    cartes: [{ genre: "valider", titre: "Encaissement de la facture F-2026-0010", icone: "euro",
      lignes: [["Client", "Julie Petit"], ["Montant", "1 196,80 € TTC"], ["Payée le", "lundi 9 novembre"], ["Mode", "Virement"]],
      bouton: "Marquer payée", iconeBouton: "coche" }] },
  { court: "Prendre un rendez-vous", texte: "Ajoute un rendez-vous chez M. Martin jeudi à 9 h.",
    reponse: "C’est noté : jeudi 12 novembre à 9 h, chez M. Martin.",
    cartes: [{ genre: "fait", texte: "Rendez-vous ajouté : jeudi 12 novembre, 9:00" }],
    questions: ["Qu’est-ce que j’ai demain ?"] },
  { court: "Une facture fournisseur", texte: "J'ai reçu une facture de Point P de 480 € TTC, à payer fin novembre.",
    reponse: "Voici la facture de Point P : 480,00 € TTC. Vérifiez, puis validez pour l’enregistrer.",
    cartes: [{ genre: "valider", titre: "Facture d’achat de Point P", icone: "panier",
      lignes: [["Fournisseur", "Point P"], ["Montant", "480,00 € TTC (400,00 € HT, TVA 80,00 €)"], ["Date", "mardi 10 novembre"], ["Paiement", "À payer avant le lundi 30 novembre"]],
      bouton: "Enregistrer", iconeBouton: "coche" }] },
  { court: "Envoyer au comptable", texte: "Envoie la compta à mon comptable.",
    reponse: "Voici l’e-mail pour votre comptable, avec la comptabilité jointe. Relisez-le, puis validez pour l’envoyer.",
    cartes: [{ genre: "valider", titre: "Envoi de la comptabilité au comptable", icone: "plateau",
      lignes: [["À", "compta@cabinet-morel.fr"], ["Pièces jointes", "Toute la comptabilité"]],
      mail: { objet: "Comptabilité 2026 — Atelier Couleurs Opale", corps: "Bonjour,\n\nVoici la comptabilité 2026, à jour au 10 novembre.", court: true },
      bouton: "Envoyer", iconeBouton: "avion" }] }
];

// ---------- L'écran : dessiné en points iPhone (402 × 874), deux pixels par point ----------
const W = 402, H = 874, K = 2;
const POLICE = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
// Thème « Minimaliste clair » (Design/ThemeCosmo.swift) : encre, texte gris à 55 %, gris des bulles à 6 %, rouge des retards
const ENCRE = "#111113", GRIS = "rgba(17, 17, 19, .55)", VOILE = "rgba(17, 17, 19, .06)", ACTION = "rgba(17, 17, 19, .07)";
const ROUGE = "#D93A3F", PERLE = "#FF6A33";
// Repères de la page (mesurés sur les captures de l'app, iPhone 402 × 874)
const HAUT_CONV = 118;      // bas de l'en-tête : la conversation commence là
const BAS_CONV = 776;       // haut de la zone de saisie
const BAS_BARRE = 832;      // bas de la barre « Écrivez quelque chose… »
const reduit = window.matchMedia("(prefers-reduced-motion: reduce)");

const toile = document.createElement("canvas");
toile.width = W * K;
toile.height = H * K;
const g = toile.getContext("2d");
g.scale(K, K);

const borne = function (x) { return Math.min(1, Math.max(0, x)); };
const sortie = function (x) { x = borne(x); return 1 - Math.pow(1 - x, 3); };
const douce = function (x) { x = borne(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
// ressort de SwiftUI (réponse, amorti) : 0 → 1, avec un léger dépassement
const ressort = function (t, reponse, amorti) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI / reponse, wd = w * Math.sqrt(1 - amorti * amorti);
  return 1 - Math.exp(-amorti * w * t) * (Math.cos(wd * t) + (amorti * w / wd) * Math.sin(wd * t));
};
const police = function (taille, graisse) { g.font = (graisse || 400) + " " + taille + "px " + POLICE; };
const serre = function (px) { if ("letterSpacing" in g) g.letterSpacing = px + "px"; };
const rond = function (x, y, l, h, r) { g.beginPath(); g.roundRect(x, y, l, h, r); };
const disque = function (x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
// hauteur d'une ligne de texte système, et position de sa ligne de base sous le haut de la ligne
const LIGNE = function (t) { return t * 1.2; };
const BASE = function (t) { return t * 0.93; };
const ecrire = function (texte, x, y, couleur, aligne) {
  g.fillStyle = couleur; g.textAlign = aligne || "left"; g.textBaseline = "alphabetic"; g.fillText(texte, x, y);
};
// coupe un texte en lignes qui tiennent dans « largeur » (les retours à la ligne sont gardés ; ligne vide = paragraphe)
// espaces insécables, comme l'app : « 7 290 € », « 480 € TTC », « 28 m² », « en retard ? »
const insecables = function (t) {
  return t.replace(/(\d) (?=\d{3}\b)/g, "$1\u00A0").replace(/(\d) (?=(€|m²|%|h\b|jours?\b))/g, "$1\u00A0")
    .replace(/€ (?=(TTC|HT)\b)/g, "€\u00A0").replace(/ ([?:!;])/g, "\u00A0$1");
};
const couper = function (texte, largeur) {
  const lignes = [];
  insecables(texte).split("\n").forEach(function (para) {
    if (!para) { lignes.push(""); return; }
    let l = "";
    para.split(" ").forEach(function (m) {
      const essai = l ? l + " " + m : m;
      if (g.measureText(essai).width > largeur && l) { lignes.push(l); l = m; } else l = essai;
    });
    lignes.push(l);
  });
  return lignes;
};

// au plus « n » lignes : la dernière se termine par « … » si le texte est plus long (lineLimit de SwiftUI)
const limiter = function (lignes, n, largeur) {
  if (lignes.length <= n) return lignes;
  const r = lignes.slice(0, n);
  let d = r[n - 1] + " " + lignes[n];
  while (d.length > 1 && g.measureText(d + "…").width > largeur) d = d.slice(0, -1);
  r[n - 1] = d.trimEnd() + "…";
  return r;
};

// ---------- Le fond de la page de Cosmo (maille du thème : blanc en haut, gris lavande en bas), dessiné une fois ----------
const fond = document.createElement("canvas");
fond.width = W * K; fond.height = H * K;
(function () {
  const f = fond.getContext("2d");
  f.scale(K, K);
  const d = f.createLinearGradient(0, 0, 0, H);
  [[0, "#FFFFFF"], [0.17, "#FEFEFE"], [0.34, "#FCFCFD"], [0.46, "#F9F9FB"], [0.57, "#F5F4F8"], [0.69, "#F1F0F5"], [0.8, "#EEEDF2"], [0.88, "#ECEBF0"], [1, "#ECEBF0"]]
    .forEach(function (s) { d.addColorStop(s[0], s[1]); });
  f.fillStyle = d; f.fillRect(0, 0, W, H);
  // les bords un peu plus sombres vers le bas (la maille est plus claire au milieu)
  [[0, 0.05], [W, 0.06]].forEach(function (c) {
    const b = f.createRadialGradient(c[0], H * 0.85, 0, c[0], H * 0.85, 140);
    b.addColorStop(0, "rgba(120, 118, 140, " + c[1] + ")"); b.addColorStop(1, "rgba(120, 118, 140, 0)");
    f.fillStyle = b; f.fillRect(0, 0, W, H);
  });
})();

// ---------- Le logo (même géométrie que le <symbol id="logo"> de la page) et la mascotte ----------
const C_LOGO = new Path2D("M126.882 52.507A65 65 0 1 0 126.882 147.493L109.131 128.496A39 39 0 1 1 109.131 71.504Z");
// le logo tient dans la boîte (17,5 ; 35) – (160 ; 165) de son repère : on le pose par son coin haut gauche et sa hauteur
function logo(x, y, hauteur) {
  const e = hauteur / 130;
  g.save();
  g.translate(x - 17.5 * e, y - 35 * e); g.scale(e, e);
  g.fillStyle = ENCRE; g.fill(C_LOGO);
  g.fillStyle = PERLE; disque(140, 100, 20); g.fill();
  g.restore();
}
// la mascotte qui réfléchit (MascotteCosmo .reflechit) : la perle orange et un œil noir, la bouche du C, tête penchée
function mascotteReflechit(cx, cy, taille, s) {
  const e = taille / 150;
  g.save();
  g.translate(cx, cy); g.rotate(-6 * Math.PI / 180); g.scale(e, e); g.translate(-95, -100);
  const bob = reduit.matches ? 0 : Math.sin(s * 2.2) * 1.4 / e * 0.3;
  g.fillStyle = PERLE; g.beginPath(); g.ellipse(122, 62 + bob, 13, 13, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = ENCRE; g.beginPath(); g.ellipse(68, 62 + bob, 13, 13, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = ENCRE; g.lineWidth = 17; g.lineCap = "round";
  g.beginPath(); g.moveTo(84, 120 + bob); g.quadraticCurveTo(98, 123 + bob, 112, 120 + bob); g.stroke();
  g.restore();
}

// ---------- Les glyphes (dessins simples des symboles SF de l'app), centrés sur (x ; y), « t » = taille de police ----------
function glyphe(nom, x, y, t, couleur) {
  const k = t / 17;
  g.save();
  g.translate(x, y); g.scale(k, k);
  g.fillStyle = couleur; g.strokeStyle = couleur; g.lineCap = "round"; g.lineJoin = "round";
  const trait = function (l) { g.lineWidth = l; g.stroke(); };
  const p = function (pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); };
  switch (nom) {
    case "croix": p([-6.6, -6.6, 6.6, 6.6]); trait(2.3); p([6.6, -6.6, -6.6, 6.6]); trait(2.3); break;
    case "chevron": p([-2.6, -5.6, 2.8, 0, -2.6, 5.6]); trait(2.6); break;
    case "historique":
      g.beginPath(); g.arc(0.6, 0, 7.8, Math.PI * 1.08, Math.PI * 2.86); trait(2);
      g.beginPath(); g.moveTo(-9.6, -3.4); g.lineTo(-6.6, 0.6); g.lineTo(-3.2, -2.6); g.closePath(); g.fill();
      p([0.6, -4.4, 0.6, 0.4, 3.8, 2.6]); trait(2); break;
    case "nouvelle":
      g.beginPath(); g.moveTo(-0.5, -7); g.lineTo(-4.6, -7); g.quadraticCurveTo(-7.2, -7, -7.2, -4.4); g.lineTo(-7.2, 4.6);
      g.quadraticCurveTo(-7.2, 7.2, -4.6, 7.2); g.lineTo(4.6, 7.2); g.quadraticCurveTo(7.2, 7.2, 7.2, 4.6); g.lineTo(7.2, 0.6); trait(2);
      p([-2.2, 3, -1.6, 0.2, 6.2, -7.6, 8.4, -5.4, 0.6, 2.4, -2.2, 3]); g.fill(); break;
    case "micro":
      rond(-3.6, -8.4, 7.2, 11.6, 3.6); g.fill();
      g.beginPath(); g.arc(0, -1.4, 6.6, Math.PI * 0.02, Math.PI * 0.98); trait(2);
      p([0, 5.2, 0, 8.2]); trait(2); p([-3.4, 8.4, 3.4, 8.4]); trait(2); break;
    case "fleche": p([0, 7, 0, -7]); trait(2.6); p([-6, -1, 0, -7, 6, -1]); trait(2.6); break;
    case "stop": rond(-5.6, -5.6, 11.2, 11.2, 2.4); g.fill(); break;
    case "liste":
      disque(-5.6, -4.6, 3.4); g.fill();
      g.strokeStyle = "#fff"; p([-7.2, -4.6, -6, -3.3, -4, -6]); trait(1.4); g.strokeStyle = couleur;
      disque(-5.6, 4.8, 2.7); trait(1.9);
      p([0.4, -4.6, 8, -4.6]); trait(2.2); p([0.4, 4.8, 8, 4.8]); trait(2.2); break;
    case "etincelles": {
      const etoile = function (cx, cy, r) {
        g.beginPath(); g.moveTo(cx, cy - r);
        g.quadraticCurveTo(cx + r * 0.12, cy - r * 0.12, cx + r, cy); g.quadraticCurveTo(cx + r * 0.12, cy + r * 0.12, cx, cy + r);
        g.quadraticCurveTo(cx - r * 0.12, cy + r * 0.12, cx - r, cy); g.quadraticCurveTo(cx - r * 0.12, cy - r * 0.12, cx, cy - r); g.fill();
      };
      etoile(1.6, 2.2, 7.6); etoile(-5.2, -4.6, 3.6); etoile(-1.6, -8.4, 1.8); break;
    }
    case "horloge":
      disque(-1.2, -0.8, 8.4); g.fill();
      g.strokeStyle = "#fff"; p([-1.2, -5.6, -1.2, -0.8, -5.6, -0.8]); trait(1.8);
      g.fillStyle = "#fff"; disque(5, 5, 5); g.fill(); g.fillStyle = couleur; disque(5, 5, 3.8); g.fill();
      g.strokeStyle = "#fff"; p([5, 3, 5, 5.4]); trait(1.4); disque(5, 7.3, 0.6); g.fillStyle = "#fff"; g.fill(); break;
    case "docTexte":
      rond(-6.5, -8.5, 13, 17, 2.6); g.fill();
      g.strokeStyle = "#fff"; p([-3.4, -4.4, 3.4, -4.4]); trait(1.5); p([-3.4, -1.2, 3.4, -1.2]); trait(1.5); p([-3.4, 2, 0.6, 2]); trait(1.5); break;
    case "calendrier":
      rond(-8.4, -7.4, 16.8, 15, 3.2); g.fill();
      g.fillStyle = "#fff"; rond(-6.6, -2.8, 13.2, 8.6, 1.4); g.fill(); g.fillStyle = couleur;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { if (r === 0 && c < 2) continue; rond(-5.4 + c * 2.5, -1.6 + r * 2.4, 1.2, 1.2, 0.3); g.fill(); }
      break;
    case "renvoi": p([-4.8, -6, -4.8, -0.4]); g.quadraticCurveTo(-4.8, 2.6, -1.8, 2.6); g.lineTo(5.6, 2.6); trait(2); p([2.2, -0.8, 5.6, 2.6, 2.2, 6]); trait(2); break;
    case "copier":
      rond(-3, -9.4, 10.4, 13.6, 2.2); g.fill();
      g.strokeStyle = "#F2F1F6"; g.lineWidth = 2.6; rond(-7.6, -4.6, 10.4, 13.8, 2.2); g.stroke(); g.fill(); break;
    case "haut-parleur":
      p([-8.4, -2.8, -5.2, -2.8, -0.6, -7.4, -0.6, 7.4, -5.2, 2.8, -8.4, 2.8]); g.closePath(); g.fill();
      g.beginPath(); g.arc(-0.6, 0, 4.4, -0.9, 0.9); trait(1.9); g.beginPath(); g.arc(-0.6, 0, 8, -0.9, 0.9); trait(1.9); break;
    case "partager":
      rond(-6.8, -2.8, 13.6, 11.8, 2.8); g.fill();
      p([0, 2.6, 0, -9.4]); trait(2.1); p([-3.4, -6.2, 0, -9.4, 3.4, -6.2]); trait(2.1); break;
    case "cloche":
      g.beginPath(); g.moveTo(-7.6, 4.6); g.quadraticCurveTo(-5.6, 2.6, -5.6, -1); g.quadraticCurveTo(-5.6, -7.4, 0, -7.6);
      g.quadraticCurveTo(5.6, -7.4, 5.6, -1); g.quadraticCurveTo(5.6, 2.6, 7.6, 4.6); g.closePath(); g.fill();
      rond(-2.4, 5.6, 4.8, 3.2, 1.6); g.fill();
      g.fillStyle = "#F3F3F4"; disque(5.8, -6.2, 4.2); g.fill(); g.fillStyle = couleur; disque(5.8, -6.2, 2.8); g.fill(); break;
    case "avion":
      p([8.4, -8.2, -8.6, -1.2, -1.6, 1.6, 1.4, 8.6]); g.closePath(); g.fill(); break;
    case "coche": p([-6.4, 0.4, -2.2, 4.8, 6.6, -5.4]); trait(2.6); break;
    case "euro":
      disque(0, 0, 8.6); g.fill(); g.fillStyle = "#fff"; g.font = "700 11px " + POLICE; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("€", 0, 0.6); break;
    case "panier":
      p([-8.6, -7.2, -5.8, -7.2, -3.8, 3.2, 6.4, 3.2, 8.4, -4.4, -4.8, -4.4]); g.closePath(); g.fill();
      disque(-2.6, 6.8, 1.7); g.fill(); disque(5, 6.8, 1.7); g.fill(); break;
    case "plateau":
      p([-8.4, 0.6, -4.2, 0.6, -2.8, 3.4, 2.8, 3.4, 4.2, 0.6, 8.4, 0.6, 8.4, 6.2]); g.quadraticCurveTo(8.4, 8, 6.6, 8);
      g.lineTo(-6.6, 8); g.quadraticCurveTo(-8.4, 8, -8.4, 6.2); g.closePath(); g.fill();
      p([0, 0.4, 0, -8]); trait(2); p([-3.4, -4.6, 0, -8, 3.4, -4.6]); trait(2); break;
    case "points": [-5.6, 0, 5.6].forEach(function (cx) { disque(cx, 0, 1.7); g.fill(); }); break;
    case "doc": case "docPlein":
      g.beginPath(); g.moveTo(-6.4, -6.4); g.quadraticCurveTo(-6.4, -8.6, -4.2, -8.6); g.lineTo(1.6, -8.6); g.lineTo(6.4, -3.8);
      g.lineTo(6.4, 6.4); g.quadraticCurveTo(6.4, 8.6, 4.2, 8.6); g.lineTo(-4.2, 8.6); g.quadraticCurveTo(-6.4, 8.6, -6.4, 6.4); g.closePath();
      if (nom === "docPlein") { g.fill(); g.strokeStyle = "#fff"; } else trait(1.8);
      p([-3.2, 0, 3.2, 0]); trait(1.5); p([-3.2, 3.4, 3.2, 3.4]); trait(1.5); break;
  }
  g.restore();
}

// ---------- La barre d'état, l'en-tête, la barre de saisie ----------
function barreEtat() {
  police(17, 600); serre(0); ecrire("09:41", 82, 38.5, ENCRE, "center");
  g.fillStyle = ENCRE;
  [4.4, 7, 9.6, 12.2].forEach(function (h, k) { rond(277 + k * 5.3, 39.4 - h, 3.6, h, 1.1); g.fill(); });
  g.strokeStyle = ENCRE; g.lineCap = "round";
  [[10.6, 2.4], [6.8, 2.4]].forEach(function (a) { g.lineWidth = a[1]; g.beginPath(); g.arc(315.4, 38.2, a[0], Math.PI * 1.24, Math.PI * 1.76); g.stroke(); });
  g.beginPath(); g.moveTo(315.4, 38.6); g.arc(315.4, 38.6, 3.6, Math.PI * 1.24, Math.PI * 1.76); g.closePath(); g.fill();
  g.fillStyle = "#34C759"; rond(333, 26.4, 26.4, 13, 4.2); g.fill();
  rond(360.6, 30.6, 1.8, 4.6, 1); g.fill();
  g.fillStyle = "rgba(255, 255, 255, .7)";
  g.beginPath(); g.moveTo(348.6, 27.6); g.lineTo(341.4, 34); g.lineTo(345.6, 34); g.lineTo(343.6, 38.4); g.lineTo(350.8, 31.6); g.lineTo(346.6, 31.6); g.closePath(); g.fill();
}

// un rond ou une capsule en verre de l'en-tête (glassEffect) : blanc, ombre douce, filet très fin
function verre(x, y, l, h) {
  g.save();
  g.shadowColor = "rgba(30, 30, 40, .09)"; g.shadowBlur = 14; g.shadowOffsetY = 4;
  g.fillStyle = "rgba(255, 255, 255, .96)"; rond(x, y, l, h, h / 2); g.fill();
  g.restore();
  g.strokeStyle = "rgba(17, 17, 19, .07)"; g.lineWidth = 0.6; rond(x, y, l, h, h / 2); g.stroke();
}

function enTete(capsule) {
  // le haut du fond derrière l'en-tête, qui s'efface vers le bas (FondEnteteAssistant) : la conversation passe dessous
  const d = g.createLinearGradient(0, 0, 0, HAUT_CONV + 22);
  d.addColorStop(0, "#FFFFFF"); d.addColorStop(0.62, "#FFFFFF"); d.addColorStop(1, "rgba(255, 255, 255, 0)");
  g.fillStyle = d; g.fillRect(0, 0, W, HAUT_CONV + 22);
  barreEtat();
  verre(16, 68, 42, 42);
  glyphe("croix", 37, 89, 17, ENCRE);
  police(17, 600); ecrire("Cosmo", W / 2, 95, ENCRE, "center");
  // conversations précédentes et nouvelle conversation, dans une capsule en verre, dès que la conversation commence
  if (capsule > 0.001) {
    const a = borne(capsule), e = 0.85 + 0.15 * capsule;
    g.save(); g.globalAlpha = a;
    g.translate(386, 89); g.scale(e, e); g.translate(-386, -89);
    verre(298, 68, 88, 42);
    glyphe("historique", 321, 89, 16, ENCRE);
    glyphe("nouvelle", 363, 89, 16, ENCRE);
    g.restore();
  }
}

// la barre de saisie en verre : le texte (ou l'invite), le petit micro gris et le rond noir (micro, flèche ou « ■ »)
function lignesBarre(texte) {
  police(16);
  return texte ? couper(texte, 370 - 8 - 14 - 44 - 38 - 6 - 6).slice(-5) : [""];
}
const hauteurBarre = function (lignes) { return Math.max(52, lignes.length * 19.2 + 22 + 8); };
function saisie(texte, curseur, repond) {
  const lignes = lignesBarre(texte);
  const h = hauteurBarre(lignes);
  const y = BAS_BARRE - h;
  g.save();
  g.shadowColor = "rgba(30, 30, 50, .07)"; g.shadowBlur = 10; g.shadowOffsetY = 2;
  g.fillStyle = "rgba(250, 249, 253, .82)"; rond(16, y, 370, h, 26); g.fill();
  g.restore();
  const reflet = g.createLinearGradient(0, y, 0, y + h);
  reflet.addColorStop(0, "rgba(255, 255, 255, .7)"); reflet.addColorStop(0.5, "rgba(255, 255, 255, .15)"); reflet.addColorStop(1, "rgba(255, 255, 255, .35)");
  g.fillStyle = reflet; rond(16, y, 370, h, 26); g.fill();
  g.strokeStyle = "rgba(17, 17, 19, .16)"; g.lineWidth = 0.8; rond(16.4, y + 0.4, 369.2, h - 0.8, 25.6); g.stroke();
  if (texte) {
    lignes.forEach(function (l, k) { ecrire(l, 34, y + 4 + 11 + BASE(16) + k * 19.2 - 0.6, ENCRE); });
    if (curseur) { const lx = 34 + g.measureText(lignes[lignes.length - 1]).width + 1.5; g.fillStyle = ENCRE; g.fillRect(lx, y + 15 + (lignes.length - 1) * 19.2, 2, 19); }
    glyphe("micro", 386 - 4 - 44 - 6 - 19, BAS_BARRE - 4 - 22, 17, GRIS);
  } else {
    ecrire("Écrivez quelque chose…", 34, BAS_BARRE - 26 + 5.7, GRIS);
  }
  g.fillStyle = ENCRE; disque(360, BAS_BARRE - 26, 22); g.fill();
  glyphe(repond ? "stop" : texte ? "fleche" : "micro", 360, BAS_BARRE - 26, repond ? 16 : 17, "#fff");
  // la barre d'accueil de l'iPhone
  g.fillStyle = "rgba(17, 17, 19, .8)"; rond(130, 861, 142, 5, 2.5); g.fill();
  return y;
}

// ---------- L'accueil de Cosmo (conversation vide), placé comme sur la capture de l'app ----------
function ligneAccueil(icone, titre, detail, yBase, detailBase, milieu) {
  glyphe(icone, 47, milieu, 17, ENCRE);
  police(15.5, 600); ecrire(titre, 74, yBase, ENCRE);
  police(13.5); detail.forEach(function (d, k) { ecrire(d, 74, detailBase + k * 16.1, GRIS); });
  glyphe("chevron", 362, milieu, 13, GRIS);
}

function dessinerAccueil(s, alpha, depart) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  // au premier envoi, l'accueil s'efface en remontant légèrement (fondu, échelle 97 %, 24 pt plus haut)
  const e = 1 - 0.03 * depart;
  g.translate(W / 2, 450 - 24 * depart); g.scale(e, e); g.translate(-W / 2, -450);
  logo(170, 205.3, 59.7);
  police(30, 600); serre(-0.6); ecrire("Bonjour Sophie", W / 2, 316.4, ENCRE, "center"); serre(0);
  police(17); ecrire("1 facture est en retard, 7 290 € à récupérer.", W / 2, 347.6, GRIS, "center");
  // ce qui attend un accord, dans une carte blanche (« Aide-moi à configurer » n'apparaît dans l'app que sur un compte
  // pas encore prêt à facturer : pas sur le site). L'app garde le bas près du pouce : la carte descend de 68 pt.
  g.fillStyle = "#fff"; rond(20, 497, 362, 80, 20); g.fill();
  ligneAccueil("liste", "4 actions attendent votre accord", ["Créer la facture du devis", "D-2026-0006 accepté"], 527.2, 546.2, 539);
  // des exemples, posés sur le fond
  police(14, 500); ecrire("Demandez par exemple", 24.4, 604.2, GRIS);
  police(15.5, 500);
  ecrire("Relance les factures impayées depuis", 64, 634.6, ENCRE); ecrire("plus de 30 jours", 64, 654, ENCRE);
  glyphe("horloge", 38, 643, 17, ENCRE);
  ecrire("Quels devis attendent une réponse ?", 64, 694, ENCRE); glyphe("docTexte", 38, 688.7, 17, ENCRE);
  ecrire("Qu’est-ce que j’ai demain ?", 64, 734, ENCRE); glyphe("calendrier", 38, 728.9, 17, ENCRE);
  g.restore();
}

// ---------- Les éléments de la conversation : chacun connaît sa hauteur et sait se dessiner à partir de son haut ----------
const LARGE = 370, GAUCHE = 16;            // largeur et bord gauche du contenu
const INT = LARGE - 32, XI = GAUCHE + 16;  // intérieur d'une carte (marges de 16)

// la question : bulle grise à droite (AssistantBulleDemande), 16 pt, marges 16 × 10, rayon 20
function bulle(texte) {
  police(16);
  const lignes = couper(texte, LARGE - 56 - 32);
  const l = Math.max.apply(null, lignes.map(function (x) { return g.measureText(x).width; })) + 32;
  const h = lignes.length * LIGNE(16) + (lignes.length - 1) * 3 + 20;
  return { h: h, l: l, dessiner: function (y) {
    const x = GAUCHE + LARGE - l;
    g.fillStyle = "#EFEFF0"; rond(x, y, l, h, Math.min(20, h / 2)); g.fill();
    police(16); lignes.forEach(function (t, k) { ecrire(t, x + 16, y + 10 + BASE(16) + k * (LIGNE(16) + 3) - 0.2, ENCRE); });
  } };
}

// « Cosmo réfléchit… » : la mascotte et une ligne grise où passe un reflet
function reflexion(s) {
  return { h: 34, dessiner: function (y) {
    mascotteReflechit(GAUCHE + 2 + 13, y + 17, 26, s);
    police(15, 500);
    const x = GAUCHE + 2 + 26 + 8, b = y + 17 + 5.2, texte = "Cosmo réfléchit…";
    ecrire(texte, x, b, GRIS);
    if (!reduit.matches) {
      const l = g.measureText(texte).width, ph = (s % 1.5) / 1.5;
      const cx = x + (ph * 1.5 - 0.45) * l + Math.max(40, l * 0.4) / 2, demi = Math.max(40, l * 0.4) / 2;
      g.save();
      g.beginPath(); g.rect(cx - demi, y, demi * 2, 34); g.clip();
      const d = g.createLinearGradient(cx - demi, 0, cx + demi, 0);
      d.addColorStop(0, "rgba(17, 17, 19, 0)"); d.addColorStop(0.5, "rgba(17, 17, 19, 1)"); d.addColorStop(1, "rgba(17, 17, 19, 0)");
      g.fillStyle = d; g.textAlign = "left"; g.fillText(texte, x, b);
      g.restore();
    }
  } };
}

// la réponse : texte libre à gauche, 16 pt, interligne 5 ; elle s'écrit mot à mot (chaque mot en fondu)
function reponse(texte) {
  police(16);
  const lignes = couper(texte, LARGE);
  const mots = [];
  lignes.forEach(function (l, k) {
    let x = GAUCHE;
    l.split(" ").forEach(function (m) { mots.push({ m: m, x: x, k: k }); x += g.measureText(m + " ").width; });
  });
  // 26 mots par seconde au moins, 2,2 s au plus ; chaque mot apparaît en 0,2 s
  const vitesse = Math.max(26, mots.length / 2.2);
  const duree = mots.length / vitesse + 0.2;
  return { h: lignes.length * LIGNE(16) + (lignes.length - 1) * 5, duree: duree, dessiner: function (y, t) {
    police(16); g.textAlign = "left"; g.textBaseline = "alphabetic";
    const tout = reduit.matches;
    mots.forEach(function (w, i) {
      const a = tout ? borne(t / 0.25) : borne((t - i / vitesse) / 0.2);
      if (a <= 0) return;
      g.globalAlpha *= a; g.fillStyle = ENCRE;
      g.fillText(w.m, w.x, y + BASE(16) + w.k * (LIGNE(16) + 5) - 0.2);
      g.globalAlpha /= a;
    });
  } };
}

// une ligne « libellé ……… valeur » (LigneValeurCosmo) : libellé gris 15,5, valeur 17 demi-gras ; la valeur longue passe à la ligne
function ligneValeur(libelle, valeur, rouge) {
  police(15.5); const ll = g.measureText(libelle).width;
  police(17, 500); const vl = couper(valeur, INT - ll - 12);
  return { h: vl.length * LIGNE(17), dessiner: function (y) {
    police(15.5); ecrire(libelle, XI, y + BASE(17), GRIS);
    police(17, 500); vl.forEach(function (v, k) { ecrire(v, XI + INT, y + BASE(17) + k * LIGNE(17), rouge ? ROUGE : ENCRE, "right"); });
  } };
}

// fond d'une carte de Cosmo : bloc blanc, rayon 20, sans bordure
function blocBlanc(y, h) { g.fillStyle = "#fff"; rond(GAUCHE, y, LARGE, h, 20); g.fill(); }

// carte « À valider » (AssistantPropositionVue) : titre 20 gras, étiquette, rond d'icône, lignes, e-mail, bouton noir, liens
function carteValider(c) {
  police(20, 700);
  const titre = couper(c.titre, INT - 40 - 12);
  const hTitre = titre.length * LIGNE(20);
  const hEntete = Math.max(hTitre + 8 + 23, 40);
  const lignes = c.lignes.map(function (l) { return ligneValeur(l[0], l[1]); });
  let mail = null;
  if (c.mail) {
    police(15, 600); const objet = couper(c.mail.objet, INT - 24);
    police(15); const corps = couper(c.mail.corps, INT - 24);
    // un e-mail court se lit en entier ; un long montre son début, puis « Lire tout »
    mail = { objet: objet, corps: corps, lire: !c.mail.court, h: 12 + objet.length * 18 + 8 + corps.length * 18 + (c.mail.court ? 12 : 8 + 43 + 12 - 6) };
  }
  let h = 16 + hEntete + 10;
  lignes.forEach(function (l) { h += 2 + 11 + l.h + 11; });
  if (mail) h += 12 + mail.h;
  h += 14 + 50 + 2 + 44 + 4;
  return { h: h, dessiner: function (y) {
    blocBlanc(y, h);
    let yy = y + 16;
    police(20, 700); titre.forEach(function (t, k) { ecrire(t, XI, yy + BASE(20) + k * LIGNE(20), ENCRE); });
    // l'étiquette « À valider » : capsule grise, 12,5 demi-gras
    police(12.5, 600);
    const lb = g.measureText("À valider").width + 18, yb = yy + hTitre + 8;
    g.fillStyle = ACTION; rond(XI, yb, lb, 23, 11.5); g.fill();
    ecrire("À valider", XI + 9, yb + 4 + BASE(12.5) + 0.6, ENCRE);
    g.fillStyle = VOILE; disque(XI + INT - 20, yy + 20, 20); g.fill();
    glyphe(c.icone, XI + INT - 20, yy + 20, 18, ENCRE);
    yy += hEntete + 10;
    lignes.forEach(function (l) { yy += 2 + 11; l.dessiner(yy); yy += l.h + 11; });
    if (mail) {
      yy += 12;
      g.fillStyle = VOILE; rond(XI, yy, INT, mail.h, 14); g.fill();
      let ym = yy + 12;
      police(15, 600); mail.objet.forEach(function (t) { ecrire(t, XI + 12, ym + 13.9, ENCRE); ym += 18; });
      ym += 8;
      police(15); mail.corps.forEach(function (t) { ecrire(t, XI + 12, ym + 13.9, GRIS); ym += 18; });
      ym += 8;
      if (mail.lire) { police(15, 600); ecrire("Lire tout", XI + 12, ym + 26.4 - 3, ENCRE); }
      yy += mail.h;
    }
    // LE bouton noir de la carte, puis « Modifier » et « Annuler » en liens gris
    yy += 14;
    g.fillStyle = ENCRE; rond(XI, yy, INT, 50, 25); g.fill();
    police(16.5, 600);
    const lt = g.measureText(c.bouton).width, lx = XI + INT / 2 - (lt + 26) / 2;
    glyphe(c.iconeBouton, lx + 9, yy + 25, 18, "#fff");
    ecrire(c.bouton, lx + 26, yy + 25 + 5.8, "#fff");
    yy += 50 + 2;
    police(15, 600);
    const lm = g.measureText("Modifier").width, la = g.measureText("Annuler").width, x0 = XI + INT / 2 - (lm + 24 + la) / 2;
    ecrire("Modifier", x0, yy + 22 + 5.3, GRIS); ecrire("Annuler", x0 + lm + 24, yy + 22 + 5.3, GRIS);
  } };
}

// plusieurs chiffres d'un coup d'œil (BlocChiffresVue) : titre gris, le chiffre clé en grand, puis une ligne par chiffre
function carteChiffres(c) {
  const lignes = c.lignes.map(function (l) {
    const v = ligneValeur(l[0], l[1], false);
    return { v: v, detail: l[2], rouge: l[3], h: v.h + (l[2] ? 3 + 15.6 : 0) };
  });
  let h = 14 + 16.8 + 2 + 18 + 4 + 45.6 + 10;
  lignes.forEach(function (l) { h += 2 + 12 + l.h + 12; });
  h += 10;
  return { h: h, dessiner: function (y) {
    blocBlanc(y, h);
    let yy = y + 14;
    police(14, 500); ecrire(c.titre, XI, yy + BASE(14), GRIS);
    yy += 16.8 + 2;
    police(15, 500); ecrire(c.cle[0], XI, yy + BASE(15), GRIS);
    yy += 18 + 4;
    police(38, 700); serre(-0.8); ecrire(c.cle[1], XI, yy + 35.4, ENCRE); serre(0);
    yy += 45.6 + 10;
    lignes.forEach(function (l) {
      yy += 2 + 12;
      l.v.dessiner(yy);
      if (l.detail) { police(13); ecrire(l.detail, XI, yy + l.v.h + 3 + BASE(13), l.rouge ? ROUGE : GRIS); }
      yy += l.h + 12;
    });
  } };
}

// une ligne de liste (LigneListeCosmo) : rond d'icône, titre et sous-titre, montant et mention, menu « … »
function carteListe(c) {
  const lignes = c.lignes.map(function (l) {
    police(17, 600); const lm = g.measureText(l.montant).width;
    police(14.5);
    const larg = INT - 40 - 12 - 12 - lm - 8 - 32;
    const sous = limiter(couper(l.sous, larg), 2, larg);
    police(17, 600); const titre = limiter(couper(l.titre, larg), 2, larg);
    return { l: l, sous: sous, titre: titre, h: 32 + Math.max(40, titre.length * LIGNE(17) + 2 + sous.length * LIGNE(14.5)) };
  });
  let h = 8;
  lignes.forEach(function (l, k) { h += l.h + (k ? 2 : 0); });
  return { h: h, dessiner: function (y) {
    blocBlanc(y, h);
    let yy = y + 4;
    lignes.forEach(function (r, k) {
      if (k) yy += 2;
      const cy = yy + r.h / 2, l = r.l;
      g.fillStyle = VOILE; disque(XI + 20, cy, 20); g.fill(); glyphe(l.icone, XI + 20, cy, 18, ENCRE);
      const ht = r.titre.length * LIGNE(17), hc = ht + 2 + r.sous.length * LIGNE(14.5), y0 = cy - hc / 2;
      police(17, 600); r.titre.forEach(function (t, j) { ecrire(t, XI + 52, y0 + BASE(17) + j * LIGNE(17), ENCRE); });
      police(14.5); r.sous.forEach(function (t, j) { ecrire(t, XI + 52, y0 + ht + 2 + BASE(14.5) + j * LIGNE(14.5), GRIS); });
      const xd = XI + INT - 40;
      police(17, 600); ecrire(l.montant, xd, cy - 2, ENCRE, "right");
      police(13, 500); ecrire(l.etat, xd, cy + 15, l.rouge ? ROUGE : GRIS, "right");
      g.fillStyle = VOILE; disque(XI + INT - 16, cy, 16); g.fill(); glyphe("points", XI + INT - 16, cy, 15, ENCRE);
      yy += r.h;
    });
  } };
}

// la vignette du PDF d'une pièce (MiniaturePiece), 40 pt de large
function miniature(x, y) {
  g.save(); g.shadowColor = "rgba(0, 0, 0, .1)"; g.shadowBlur = 3; g.shadowOffsetY = 0.5;
  g.fillStyle = "#fff"; rond(x, y, 40, 56, 3); g.fill(); g.restore();
  g.strokeStyle = "rgba(17, 17, 19, .14)"; g.lineWidth = 0.5; rond(x, y, 40, 56, 3); g.stroke();
  g.fillStyle = PERLE; g.fillRect(x + 3, y + 3.5, 3, 3); g.fillRect(x + 30, y + 3.5, 7, 1.6);
  g.fillStyle = "rgba(17, 17, 19, .5)"; g.fillRect(x + 7.5, y + 4, 9, 1.2); g.fillRect(x + 31, y + 6.4, 6, 0.9);
  g.fillStyle = "rgba(17, 17, 19, .28)";
  [10.5, 12.5, 14.5].forEach(function (v) { g.fillRect(x + 3, y + v, 12, 0.8); });
  [19.5, 22, 24.5, 27, 29.5].forEach(function (v) { g.fillRect(x + 3, y + v, 20, 0.8); g.fillRect(x + 27, y + v, 4, 0.8); g.fillRect(x + 33, y + v, 4, 0.8); });
  g.fillStyle = "#EFEFF1"; g.fillRect(x + 3, y + 17.4, 34, 1.2);
  g.fillStyle = PERLE; g.fillRect(x + 25, y + 34, 12, 2.2);
  g.fillStyle = "rgba(17, 17, 19, .2)"; [40, 42].forEach(function (v) { g.fillRect(x + 3, y + v, 30, 0.6); });
  g.fillRect(x + 3, y + 52, 2, 0.6); g.fillRect(x + 35, y + 52, 2, 0.6);
}

// la pièce et sa vignette (AssistantRappelPiece) : la vraie pièce, comme dans l'app
function cartePiece(c) {
  police(17, 600); const lm = g.measureText(c.montant).width;
  police(14.5);
  const larg = INT - 40 - 12 - 12 - lm;
  const sous = limiter(couper(c.sous, larg), 2, larg);
  const hc = Math.max(56, LIGNE(17) + 2 + sous.length * LIGNE(14.5));
  const h = 4 + 16 + hc + 16 + 4;
  return { h: h, dessiner: function (y) {
    blocBlanc(y, h);
    const cy = y + h / 2;
    miniature(XI, cy - 28);
    const hx = LIGNE(17) + 2 + sous.length * LIGNE(14.5), y0 = cy - hx / 2;
    police(17, 600); ecrire(c.titre, XI + 52, y0 + BASE(17), ENCRE);
    police(14.5); sous.forEach(function (t, j) { ecrire(t, XI + 52, y0 + LIGNE(17) + 2 + BASE(14.5) + j * LIGNE(14.5), GRIS); });
    police(17, 600); ecrire(c.montant, XI + INT, cy - 2, ENCRE, "right");
    police(13, 500); ecrire(c.etat, XI + INT, cy + 15, c.rouge ? ROUGE : GRIS, "right");
  } };
}

// ce qui est déjà fait (carte repliée ou action faite tout de suite) : le logo, la phrase, « Annuler »
function carteFait(c) {
  police(15, 600);
  const lignes = couper(c.texte, INT - 30 - 10 - 6 - 62);
  const h = 10 + Math.max(44, lignes.length * 18) + 10;
  return { h: h, dessiner: function (y) {
    blocBlanc(y, h);
    const cy = y + h / 2;
    logo(XI + 1.5, cy - 12.6, 25.2);
    police(15, 600); lignes.forEach(function (t, k) { ecrire(t, XI + 40, cy - lignes.length * 9 + 13.9 + k * 18, ENCRE); });
    police(15, 600); ecrire("Annuler", XI + INT, cy + 5.3, GRIS, "right");
  } };
}

// les suites en un geste (capsules grises 13 demi-gras, icône 14)
function suites(c) {
  return { h: 32, dessiner: function (y) {
    let x = GAUCHE;
    c.capsules.forEach(function (s) {
      police(13, 600);
      const l = 12 + 14 + 6 + g.measureText(s[0]).width + 12;
      g.fillStyle = VOILE; rond(x, y, l, 32, 16); g.fill();
      glyphe(s[1], x + 12 + 7, y + 16, 13, ENCRE);
      ecrire(s[0], x + 12 + 14 + 6, y + 16 + 4.6, ENCRE);
      x += l + 6;
    });
  } };
}

// la fin de l'échange : liens d'action « ↳ », copier / lire / partager, puis les questions suggérées
function pied(d, dernier) {
  const liens = d.liens || [], questions = dernier ? (d.questions || []) : [];
  let h = liens.length * (LIGNE(16) + 14) + 26 + (questions.length ? 14 + 8 + questions.length * (LIGNE(15.5) + 20) : 0);
  return { h: h, dessiner: function (y) {
    let yy = y;
    liens.forEach(function (l) {
      glyphe("renvoi", GAUCHE + 7, yy + 9.4, 13, GRIS);
      police(16); ecrire(l, GAUCHE + 24, yy + BASE(16), ENCRE);
      const lw = g.measureText(l).width;
      g.strokeStyle = GRIS; g.lineWidth = 0.9; g.setLineDash([3, 2.2]);
      g.beginPath(); g.moveTo(GAUCHE + 24, yy + 18.3); g.lineTo(GAUCHE + 24 + lw, yy + 18.3); g.stroke(); g.setLineDash([]);
      yy += LIGNE(16) + 14;
    });
    glyphe("copier", GAUCHE + 9, yy + 13, 15, GRIS);
    glyphe("haut-parleur", GAUCHE + 36 + 10, yy + 13, 15, GRIS);
    glyphe("partager", GAUCHE + 72 + 8, yy + 13, 15, GRIS);
    yy += 26;
    if (questions.length) {
      yy += 14 + 8;
      questions.forEach(function (q) {
        const cy = yy + 10 + LIGNE(15.5) / 2;
        glyphe(q.indexOf("demain") >= 0 ? "calendrier" : "docTexte", GAUCHE + 13, cy, 17, ENCRE);
        police(15.5, 500); ecrire(q, GAUCHE + 40, cy + 5.4, ENCRE);
        yy += LIGNE(15.5) + 20;
      });
    }
  } };
}

const FABRIQUES = { valider: carteValider, chiffres: carteChiffres, liste: carteListe, piece: cartePiece, fait: carteFait, suites: suites };

// ---------- Le déroulé d'une demande : tout se calcule à partir du temps écoulé depuis qu'on l'a touchée ----------
const ECRIT = 0.3, FRAPPE = 42, PENSE = 1.5;
const memo = {};
function preparer(i) {
  if (memo[i]) return memo[i];
  const d = DEMANDES[i];
  const r = reponse(d.reponse);
  const tEnvoi = ECRIT + d.texte.length / FRAPPE + 0.35;
  const tReponse = tEnvoi + PENSE;
  const tFin = tReponse + 0.18 + r.duree;
  memo[i] = {
    d: d, bulle: bulle(d.texte), reponse: r,
    cartes: d.cartes.map(function (c) { return FABRIQUES[c.genre](c); }),
    pieds: [pied(d, true), pied(d, false)],
    tEnvoi: tEnvoi, tReponse: tReponse, tFin: tFin, fini: tFin + 5.2
  };
  return memo[i];
}

// les éléments visibles de la demande i, t secondes après son départ, empilés à partir de 0 (haut de la question)
function plan(i, t, s, dernier) {
  const p = preparer(i);
  const els = [];
  if (t < p.tEnvoi) return { els: els, h: 0, hFinal: 0, p: p };
  let y = 14;
  els.push({ el: p.bulle, y: y, genre: "bulle" });
  y += p.bulle.h + 18;
  if (t >= p.tEnvoi + 0.25 && t < p.tReponse + 0.12) {
    els.push({ el: reflexion(s), y: y, a: borne((t - p.tEnvoi - 0.25) / 0.25) * (t > p.tReponse ? 1 - (t - p.tReponse) / 0.12 : 1) });
  }
  let h = y;
  if (t >= p.tReponse) {
    els.push({ el: p.reponse, y: y, t0: p.tReponse + 0.18, genre: "reponse" });
    h = y + p.reponse.h;
  }
  // les cartes attendent la fin de l'écriture, puis entrent en ressort, l'une après l'autre (60 ms d'écart)
  let yy = y + p.reponse.h;
  p.cartes.forEach(function (c, k) {
    const ecart = k === 0 ? 18 : (p.d.cartes[k - 1].genre === "fait" || p.d.cartes[k - 1].genre === "piece") ? 10 : 18;
    yy += ecart;
    if (t >= p.tFin) { els.push({ el: c, y: yy, t0: p.tFin + 0.06 * k, genre: "carte" }); h = yy + c.h; }
    yy += c.h;
  });
  const pi = p.pieds[dernier ? 0 : 1];
  yy += 18;
  if (t >= p.tFin) { els.push({ el: pi, y: yy, t0: p.tFin + 0.1 + Math.min(p.cartes.length, 4) * 0.06, genre: "pied" }); h = yy + pi.h; }
  return { els: els, h: h, hFinal: yy + pi.h, p: p };
}

// défilement d'un échange : la question en haut ; quand la carte déborde, on descend doucement jusqu'à son bouton
function defilement(pl, t) {
  const deborde = Math.max(0, HAUT_CONV + pl.hFinal + 12 - BAS_CONV);
  if (!deborde || t < pl.p.tFin + 0.8) return 0;
  return deborde * (reduit.matches ? 1 : douce((t - pl.p.tFin - 0.8) / 1.1));
}

function dessinerEchange(pl, t, origine, alpha, s) {
  pl.els.forEach(function (e) {
    let a = alpha, dy = 0, ech = 1;
    if (e.genre === "bulle") {
      // pendant son vol depuis la barre, la question est dessinée à part (au-dessus de tout)
      if (!reduit.matches && t < pl.p.tEnvoi + 0.9) return;
      if (reduit.matches) a *= borne((t - pl.p.tEnvoi) / 0.25);
    } else if (e.genre === "carte") {
      const x = t - e.t0;
      if (reduit.matches) a *= borne(x / 0.3);
      else { const r = ressort(x, 0.5, 0.74); a *= borne(r * 1.4); dy = (1 - r) * 18; ech = 0.96 + 0.04 * r; }
    } else if (e.genre === "pied") {
      const x = sortie((t - e.t0) / 0.3);
      a *= x; if (!reduit.matches) dy = (1 - x) * 8;
    } else if (e.a !== undefined) a *= borne(e.a);
    if (a <= 0.001) return;
    const y = origine + e.y;
    if (y > BAS_CONV + 40 || y + e.el.h < 0) return;
    g.save();
    g.globalAlpha = a;
    if (ech !== 1) { g.translate(W / 2, y); g.scale(ech, ech); g.translate(-W / 2, -y); }
    g.translate(0, dy);
    e.el.dessiner(y, e.genre === "reponse" ? t - e.t0 : s);
    g.restore();
  });
}

// ---------- L'écran entier, à l'instant « maintenant » ----------
let courant = -1, precedent = -1, debut = 0, finPrecedent = 0, haut0 = 0;

function dessiner(maintenant) {
  const s = maintenant / 1000;
  g.globalAlpha = 1;
  g.drawImage(fond, 0, 0, W, H);
  let tape = "", repond = false, capsule = 0, volant = null;

  const t = courant >= 0 ? s - debut : 0;
  const pl = courant >= 0 ? plan(courant, t, s, true) : null;
  const envoye = pl && t >= pl.p.tEnvoi;
  // la question qui monte : ressort de SwiftUI (0,48 s, amorti 0,86)
  const vol = envoye ? (reduit.matches ? 1 : ressort(t - pl.p.tEnvoi, 0.48, 0.86)) : 0;

  g.save();
  g.beginPath(); g.rect(0, 0, W, BAS_CONV); g.clip();
  if (precedent >= 0) {
    // l'échange d'avant, figé là où on l'a laissé ; la nouvelle question le pousse vers le haut
    const pp = plan(precedent, finPrecedent, s, !envoye);
    const o = HAUT_CONV - defilement(pp, finPrecedent);
    const monte = envoye ? (haut0 - HAUT_CONV) * vol : 0;
    dessinerEchange(pp, finPrecedent, o - monte, 1, s);
    capsule = 1;
  } else {
    // l'accueil, qui s'efface au premier envoi
    const x = envoye ? borne((t - pl.p.tEnvoi) / 0.22) : 0;
    dessinerAccueil(s, 1 - sortie(x), reduit.matches ? 0 : sortie(x));
    if (envoye) capsule = reduit.matches ? 1 : ressort(t - pl.p.tEnvoi, 0.38, 0.82);
  }
  if (envoye) {
    const prevBas = precedent >= 0 ? haut0 : HAUT_CONV;
    const o = HAUT_CONV + (prevBas - HAUT_CONV) * (1 - vol) - defilement(pl, t);
    dessinerEchange(pl, t, o, 1, s);
    repond = t < pl.p.tFin;
    if (!reduit.matches && t < pl.p.tEnvoi + 0.9) volant = vol;
  }
  g.restore();

  if (pl && t >= ECRIT && t < pl.p.tEnvoi) tape = pl.p.d.texte.slice(0, Math.ceil((t - ECRIT) * FRAPPE));
  saisie(tape, tape && Math.floor(s * 2.2) % 2 === 0, repond);
  // la question en vol, posée sur la barre de saisie au départ, jusqu'à sa place en haut de la conversation
  if (volant !== null) {
    const depart = BAS_BARRE - hauteurBarre(lignesBarre(pl.p.d.texte)), arrivee = HAUT_CONV + 14;
    pl.p.bulle.dessiner(depart + (arrivee - depart) * volant);
  }
  enTete(capsule);

  if (pl) {
    if (!annonce.dataset.fait && t >= pl.p.tReponse) { annonce.textContent = pl.p.d.reponse; annonce.dataset.fait = "1"; }
    if (t >= pl.p.fini && !manuel && visible) jouer((courant + 1) % DEMANDES.length);
  }
}

let manuel = false, visible = false;
let boutons = [];
// « delai » : secondes d'accueil avant que la demande commence à s'écrire
function jouer(i, delai) {
  const s = performance.now() / 1000;
  if (courant >= 0) {
    const p = preparer(courant), t = s - debut;
    // une demande touchée avant que la précédente soit partie : on garde l'échange d'avant
    if (t >= p.tEnvoi) {
      precedent = courant;
      // touchée pendant que Cosmo réfléchit : l'échange d'avant garde sa question seule (pas de « réfléchit » figé)
      finPrecedent = t < p.tReponse ? p.tEnvoi + 0.2 : Math.min(t, p.fini);
      const pp = plan(precedent, finPrecedent, 0, false);
      haut0 = HAUT_CONV - defilement(pp, finPrecedent) + pp.h + 18;
    }
  }
  courant = i;
  debut = s + (delai || 0);
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
    b.addEventListener("click", function () {
      manuel = true;
      jouer(i);
      // sur téléphone, l'iPhone est sous les demandes : on le ramène à l'écran pour voir Cosmo répondre
      if (window.innerWidth < 900) {
        const r = boite.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.3 || r.bottom < window.innerHeight * 0.7) {
          const doux = !reduit.matches;
          boite.scrollIntoView({ behavior: doux ? "smooth" : "auto", block: "center" });
        }
      }
    });
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
      // la première fois, l'accueil de Cosmo reste un moment avant la première demande
      if (!manuel) jouer(courant < 0 ? 0 : (courant + 1) % DEMANDES.length, courant < 0 ? 2.5 : 0);
      if (!attente) attente = requestAnimationFrame(tour);
    }
  }, { threshold: 0.35 }).observe(boite);
}

if (boite && zone && annonce) {
  // le modèle 3D (près d'1 Mo) ne se charge qu'à l'approche de la section : la page s'ouvre plus vite sur téléphone
  const bientot = new IntersectionObserver(function (e) {
    if (!e[0].isIntersecting) return;
    bientot.disconnect();
    demarrer();
  }, { rootMargin: "1200px 0px" });
  bientot.observe(boite);
}
