// « Une phrase suffit » — un iPhone en vraie 3D (three.js) pour chacune des trois étapes
//
// Modèle : « Apple iPhone 15 Pro Max Black » de polyman (https://sketchfab.com/Polyman_3D),
// licence CC BY 4.0 (crédit dans le pied de page). Fichier : modeles/iphone-15-pro.glb.
//
// - Chaque étape ([data-iphone3d]) a son iPhone. Quand l'étape arrive à l'écran, l'iPhone se retourne au fil
//   du défilement (de dos → de face), en douceur ; puis son écran passe la vidéo de la vraie app, une fois,
//   et s'arrête sur la dernière image. Si l'étape sort complètement de l'écran, tout repart de zéro.
// - Les vidéos (images/recit-1.mp4, -2, -3) viennent d'un film du simulateur (app lancée avec
//   « -demo peintre -dicteeFichier phrase.m4a » : la dictée passe par la vraie transcription, sans micro),
//   avec un doigt ajouté au moment des deux appuis.
// - Pas d'écran noir : l'écran montre d'abord la première image de la vidéo (images/recit-N-debut.jpg),
//   la vidéo est mise en mémoire avant que l'étape arrive (play puis pause, ce qu'exige l'iPhone),
//   et elle ne prend la place de l'image qu'une fois sa lecture vraiment partie.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const boites = Array.prototype.slice.call(document.querySelectorAll("[data-iphone3d]"));
const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (boites.length) demarrer();

function demarrer() {
  // le modèle est compressé (Draco) : le décodeur vient du même endroit que three.js
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
  const chargeur = new GLTFLoader();
  chargeur.setDRACOLoader(draco);

  const etapes = boites.map(creer).filter(Boolean);
  if (!etapes.length) return;

  chargeur.load("modeles/iphone-15-pro.glb", function (gltf) {
    const modele = gltf.scene;
    modele.traverse(function (o) {
      // le logo Apple au dos est une marque déposée : on le retire (son dessin et la couche du dos qui le découpe)
      if (o.isMesh && (o.name === "IykfmVvLplTsTEW" || o.name === "WJwwVjsahIXbJpU")) o.visible = false;
    });
    const b = new THREE.Box3().setFromObject(modele);
    modele.position.sub(b.getCenter(new THREE.Vector3()));
    const hauteur = b.getSize(new THREE.Vector3()).y;
    etapes.forEach(function (e) { e.installer(modele, hauteur); });
    requestAnimationFrame(boucle);
  });

  // Une seule boucle de dessin pour les trois iPhone ; seuls ceux à l'écran sont dessinés
  let avant = 0;
  function boucle(t) {
    const dt = avant ? Math.min(0.1, (t - avant) / 1000) : 0.016;
    avant = t;
    etapes.forEach(function (e) { if (e.visible) e.dessiner(dt, t); });
    requestAnimationFrame(boucle);
  }
  window.addEventListener("resize", function () { etapes.forEach(function (e) { e.cadrer(); }); });
}

function creer(boite, i) {
  const video = boite.querySelector("[data-recit-video]");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    boite.classList.add("sans-3d");
    return null;
  }
  // 1,5 au plus : net sur les écrans Retina, sans faire ramer le Mac
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

  // L'écran : d'abord la première image (tout de suite là), puis la vidéo de l'étape quand elle tourne
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  const image = new THREE.TextureLoader().load(video.getAttribute("src").replace(/\.mp4$/, "-debut.jpg"), function () { force = true; });
  image.colorSpace = THREE.SRGBColorSpace;
  image.flipY = true;
  const ecran = new THREE.MeshBasicMaterial({ map: image, toneMapped: false });
  const montrer = function (t) { if (ecran.map !== t) { ecran.map = t; ecran.needsUpdate = true; force = true; } };
  // la vidéo prend l'écran à sa première vraie image affichée
  video.addEventListener("playing", function () {
    if (!joue) return;
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(function () { if (joue) montrer(texture); });
    else montrer(texture);
  });
  // mise en mémoire avant d'arriver : l'iPhone ignore preload, il faut lancer puis arrêter la lecture (vidéo muette)
  let chauffee = false;
  const chauffer = function () {
    if (chauffee) return;
    chauffee = true;
    const p = video.play();
    if (p && p.then) p.then(function () { if (!joue) { video.pause(); video.currentTime = 0; } }).catch(function () {});
  };

  // l'iPhone arrive d'un côté, puis de l'autre, une étape sur deux
  const sens = i % 2 === 0 ? 1 : -1;
  let hauteur = 1;
  let pret = false;
  let rA = 0;          // retournement affiché (0 : de dos, 1 : de face), qui rattrape la cible en douceur
  let joue = false;
  let force = true;    // un dessin forcé (installation, taille de la fenêtre)

  const e = {
    visible: false,
    installer: function (modele, h) {
      const copie = modele.clone(true);
      copie.traverse(function (o) { if (o.isMesh && o.material && o.material.name === "pIJKfZsazmcpEiU") o.material = ecran; });
      pivot.add(copie);
      hauteur = h;
      pret = true;
      boite.classList.add("pret");
      e.cadrer();
      e.dessiner(0.016, 0);
    },
    cadrer: function () {
      const l = boite.clientWidth, h = boite.clientHeight;
      if (!l || !h) return;
      renderer.setSize(l, h, false);
      camera.aspect = l / h;
      // la hauteur du téléphone remplit 90 % de la boîte
      const d = (hauteur / 0.9) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.set(0, 0, d);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      force = true;
    },
    dessiner: function (dt, t) {
      if (!pret) return;
      // Cible : 0 quand le haut de l'étape entre en bas de l'écran, 1 quand il est remonté de 60 % de l'écran
      const rect = boite.getBoundingClientRect();
      const vh = window.innerHeight;
      const cible = reduit ? 1 : Math.min(1, Math.max(0, (vh - rect.top) / (vh * 0.6)));
      const ecart = cible - rA;
      // Rien ne bouge (iPhone posé, vidéo arrêtée) : on ne redessine pas, la page reste fluide
      if (Math.abs(ecart) < 0.0005 && video.paused && !force) return;
      force = false;
      rA = Math.abs(ecart) < 0.0005 ? cible : rA + ecart * (1 - Math.exp(-dt * 8));
      const lisse = rA < 0.5 ? 4 * rA * rA * rA : 1 - Math.pow(-2 * rA + 2, 3) / 2;
      const dos = 1 - lisse;
      // Dans le modèle, l'écran regarde vers -z : de face, il faut un demi-tour (π)
      pivot.rotation.set(dos * 0.22, Math.PI + sens * dos * Math.PI - 0.12 * sens * lisse, dos * -0.06 * sens);
      pivot.position.y = -dos * hauteur * 0.06;
      renderer.render(scene, camera);

      // La vidéo part quand l'iPhone est de face ; elle repart de zéro si l'étape a quitté l'écran
      if (!joue && rA > 0.92) {
        joue = true;
        video.currentTime = 0;
        const lecture = video.play();
        if (lecture && lecture.catch) lecture.catch(function () {});
      }
    }
  };

  // dernière image de la vidéo : un dernier dessin pour qu'elle reste bien à l'écran
  video.addEventListener("ended", function () { force = true; });
  // un peu avant l'écran : on prépare la vidéo ; à l'écran : on dessine
  new IntersectionObserver(function (entrees) {
    if (entrees[0].isIntersecting) chauffer();
  }, { rootMargin: "900px 0px" }).observe(boite);
  new IntersectionObserver(function (entrees) {
    e.visible = entrees[0].isIntersecting;
    force = true;
    if (!e.visible && joue) {
      joue = false;
      rA = 0;
      video.pause();
      video.currentTime = 0;
      montrer(image);
    }
  }).observe(boite);
  return e;
}
