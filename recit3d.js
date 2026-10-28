// « Vous le dites. C'est prêt. » — UN iPhone en vraie 3D (three.js) pour les trois étapes
//
// Modèle : « Apple iPhone 15 Pro Max Black » de polyman (https://sketchfab.com/Polyman_3D),
// licence CC BY 4.0 (crédit dans le pied de page). Fichier : modeles/iphone-15-pro.glb.
//
// - La scène (.recit-scene) reste fixe à l'écran pendant qu'on fait défiler la section : l'avancement choisit l'étape
//   (1 : vous parlez, 2 : Cosmo prépare, 3 : vous validez). Un seul moteur 3D, au lieu d'un par étape.
// - À l'arrivée, l'iPhone se retourne (de dos → de face) ; à chaque changement d'étape, il pivote un peu et son écran
//   passe la vidéo de cette étape (images/recit-1.mp4, -2, -3), une fois, arrêtée sur la dernière image.
//   Les vidéos viennent d'un film du simulateur (app lancée avec « -demo peintre -dicteeFichier phrase.m4a » :
//   la dictée passe par la vraie transcription, sans micro), avec un doigt ajouté au moment des deux appuis.
// - Pas d'écran noir : l'écran montre d'abord la première image de la vidéo (images/recit-N-debut.jpg), les vidéos sont
//   mises en mémoire avant d'arriver (lancer puis arrêter, ce qu'exige l'iPhone), et une vidéo ne prend la place de
//   l'image qu'une fois sa lecture vraiment partie.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const section = document.querySelector("[data-recit]");
const boite = section && section.querySelector("[data-recit3d]");
const etapes = section ? Array.prototype.slice.call(section.querySelectorAll(".recit-etape")) : [];
const points = section ? Array.prototype.slice.call(section.querySelectorAll(".recit-points i")) : [];
const suite = section && section.querySelector(".recit-suite");
const videos = boite ? Array.prototype.slice.call(boite.querySelectorAll("[data-recit-video]")) : [];
const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (section && boite && videos.length === 3) demarrer();

function demarrer() {
  const borne = function (x) { return Math.min(1, Math.max(0, x)); };
  let actuelle = -1;

  // ---------- l'étape en cours, d'après l'avancement dans la section ----------
  function avancement() {
    const total = section.offsetHeight - window.innerHeight;
    return total > 0 ? borne(-section.getBoundingClientRect().top / total) : 0;
  }
  function etapeDe(p) { return p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2; }
  function marquer(i) {
    etapes.forEach(function (e, k) { e.classList.toggle("actif", k === i); });
    points.forEach(function (e, k) { e.classList.toggle("actif", k === i); });
    videos.forEach(function (v, k) { v.classList.toggle("actif", k === i); });
  }

  // ---------- la 3D ----------
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    renderer = null;
  }
  if (!renderer) {
    // sans WebGL : la vidéo de l'étape s'affiche simplement (style.css, .sans-3d)
    boite.classList.add("sans-3d");
    const suivre = function () {
      const i = etapeDe(avancement());
      if (i === actuelle) return;
      actuelle = i;
      marquer(i);
      videos.forEach(function (v, k) { if (k === i) { v.currentTime = 0; v.play().catch(function () {}); } else v.pause(); });
    };
    window.addEventListener("scroll", suivre, { passive: true });
    suivre();
    return;
  }
  // 1,5 au plus : net sur les écrans Retina, sans faire ramer
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  boite.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const lumiere = new THREE.DirectionalLight(0xffffff, 1.4);
  lumiere.position.set(2, 3, 4);
  scene.add(lumiere);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 10);
  const pivot = new THREE.Group();
  scene.add(pivot);

  let force = true;      // un dessin forcé (chargement, taille, image qui change)
  let joue = -1;         // la vidéo en cours de lecture (-1 : aucune)

  // L'écran : la première image de chaque vidéo d'abord, puis la vidéo quand elle tourne vraiment
  const images = videos.map(function (v) {
    const t = new THREE.TextureLoader().load(v.getAttribute("src").replace(/\.mp4$/, "-debut.jpg"), function () { force = true; });
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = true;
    return t;
  });
  const films = videos.map(function (v) {
    const t = new THREE.VideoTexture(v);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = true;
    return t;
  });
  const ecran = new THREE.MeshBasicMaterial({ map: images[0], toneMapped: false });
  const montrer = function (t) { if (ecran.map !== t) { ecran.map = t; ecran.needsUpdate = true; force = true; } };
  videos.forEach(function (v, k) {
    v.addEventListener("playing", function () {
      if (joue !== k) return;
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(function () { if (joue === k) montrer(films[k]); });
      else montrer(films[k]);
    });
    // dernière image : un dernier dessin pour qu'elle reste bien à l'écran
    v.addEventListener("ended", function () { force = true; });
  });

  // mise en mémoire des trois vidéos un peu avant d'arriver (l'iPhone ignore preload)
  let chauffees = false;
  const chauffer = function () {
    if (chauffees) return;
    chauffees = true;
    videos.forEach(function (v, k) {
      const p = v.play();
      if (p && p.then) p.then(function () { if (joue !== k) { v.pause(); v.currentTime = 0; } }).catch(function () {});
    });
  };

  function lancer(i) {
    videos.forEach(function (v, k) { if (k !== i) { v.pause(); v.currentTime = 0; } });
    joue = i;
    montrer(images[i]);
    const v = videos[i];
    v.currentTime = 0;
    const p = v.play();
    if (p && p.catch) p.catch(function () {});
  }
  // l'avancement de la vidéo se voit à gauche (trait ou pastille qui se remplit) ; une fois finie, on invite à continuer
  let progAffiche = -1;
  function suivreLecture() {
    const v = videos[actuelle];
    const prog = v && v.duration ? Math.min(1, v.currentTime / v.duration) : 0;
    if (Math.abs(prog - progAffiche) > 0.004) {
      progAffiche = prog;
      section.style.setProperty("--prog", prog.toFixed(3));
    }
    if (suite) suite.classList.toggle("visible", joue === actuelle && (v.ended || prog > 0.98) && actuelle < 2);
  }
  function arreter() {
    joue = -1;
    videos.forEach(function (v) { v.pause(); v.currentTime = 0; });
  }

  let hauteur = 1, pret = false, rA = 0, coup = 0, sensCoup = 1, visible = false, boucle = 0, avant = 0;

  function cadrer() {
    const l = boite.clientWidth, h = boite.clientHeight;
    if (!l || !h) return;
    renderer.setSize(l, h, false);
    camera.aspect = l / h;
    // la hauteur du téléphone remplit 92 % de la boîte
    const d = (hauteur / 0.92) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    force = true;
  }

  function image(t) {
    boucle = visible ? requestAnimationFrame(image) : 0;
    const dt = avant ? Math.min(0.1, (t - avant) / 1000) : 0.016;
    avant = t;
    if (!pret) return;

    // l'étape d'après l'avancement ; à chaque changement : petit pivot et nouvelle vidéo
    const i = etapeDe(avancement());
    if (i !== actuelle) {
      if (actuelle >= 0 && !reduit) { coup = 1; sensCoup = i > actuelle ? 1 : -1; }
      actuelle = i;
      marquer(i);
      if (rA > 0.92) lancer(i);
    }

    // retournement à l'arrivée : 0 quand le haut de la section entre en bas de l'écran, 1 un demi-écran plus loin
    const vh = window.innerHeight;
    const cible = reduit ? 1 : borne((vh - section.getBoundingClientRect().top) / (vh * 0.5));
    const ecart = cible - rA;
    const bouge = Math.abs(ecart) > 0.0005 || coup > 0.001;
    if (!bouge && videos[actuelle].paused && !force) { suivreLecture(); return; }
    force = false;
    rA = Math.abs(ecart) < 0.0005 ? cible : rA + ecart * (1 - Math.exp(-dt * 8));
    coup = coup > 0.001 ? coup * Math.exp(-dt * 3.2) : 0;
    const lisse = rA < 0.5 ? 4 * rA * rA * rA : 1 - Math.pow(-2 * rA + 2, 3) / 2;
    const dos = 1 - lisse;
    // pivot de changement d'étape : un aller-retour amorti autour de l'axe vertical
    const pivotEtape = sensCoup * Math.sin(coup * Math.PI) * 0.32 * coup;
    // Dans le modèle, l'écran regarde vers -z : de face, il faut un demi-tour (π)
    pivot.rotation.set(dos * 0.22, Math.PI + dos * Math.PI - 0.14 * lisse + pivotEtape, dos * -0.06);
    pivot.position.y = -dos * hauteur * 0.06;
    renderer.render(scene, camera);

    // la vidéo de l'étape part quand l'iPhone est de face
    if (rA > 0.92 && joue !== actuelle) lancer(actuelle);
    suivreLecture();
  }

  const draco = new DRACOLoader();
  draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
  const chargeur = new GLTFLoader();
  chargeur.setDRACOLoader(draco);
  chargeur.load("modeles/iphone-15-pro.glb", function (gltf) {
    const modele = gltf.scene;
    modele.traverse(function (o) {
      if (!o.isMesh) return;
      // le logo Apple au dos est une marque déposée : on le retire (son dessin et la couche du dos qui le découpe)
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
    if (visible && !boucle) boucle = requestAnimationFrame(image);
  });

  // un peu avant l'écran : on prépare les vidéos ; dans la section : on dessine ; en dehors : tout repart de zéro
  new IntersectionObserver(function (e) { if (e[0].isIntersecting) chauffer(); }, { rootMargin: "900px 0px" }).observe(section);
  new IntersectionObserver(function (e) {
    visible = e[0].isIntersecting;
    force = true;
    if (visible && !boucle) { avant = 0; boucle = requestAnimationFrame(image); }
    if (!visible) {
      arreter();
      rA = 0;
      actuelle = -1;
      montrer(images[0]);
    }
  }).observe(section);
  window.addEventListener("resize", cadrer);
}
