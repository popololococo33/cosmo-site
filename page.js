// Page de vente — Cosmo par Cosmosoft (version 10, épurée)
//
// 1. Barre du haut : sans trait tout en haut, un fin trait dès qu'on fait défiler.
// 2. Apparitions au défilement : les blocs .apparait reçoivent .vu en entrant à l'écran,
//    avec un petit décalage entre voisins. C'est le seul mouvement après le haut de page.
// 3. Lien vers une question (#q-…) : la réponse s'ouvre.
// 4. Haut de page : --p (0 → 1) suit le défilement, les téléphones s'écartent doucement.
// (Les étapes « Une phrase suffit » et leurs iPhone 3D sont dans recit3d.js.)
// 5. La nouvelle ère : dix outils qui fusionnent en un seul, au défilement.
// 5 ter. Ce que coûtent les autres logiciels : des bulles avec leur prix, barrées puis éclatées.
// 6. Questions : la réponse s'ouvre et se ferme en douceur.

(function () {
  "use strict";

  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const io = "IntersectionObserver" in window;

  // ---------- 1. Barre du haut ----------
  const entete = document.getElementById("entete");
  if (entete) {
    let demande = false;
    const maj = function () { demande = false; entete.classList.toggle("au-sommet", window.scrollY < 24); };
    window.addEventListener("scroll", function () {
      if (!demande) { demande = true; requestAnimationFrame(maj); }
    }, { passive: true });
    maj();
  }
  // menu des sections sur écran étroit : se ferme au choix d'une section, avec Échap ou en touchant ailleurs
  const menuBouton = document.querySelector(".menu-bouton");
  const menu = document.getElementById("menu-sections");
  if (menuBouton && menu) {
    const regler = function (ouvert) {
      menu.classList.toggle("ouvert", ouvert);
      menuBouton.setAttribute("aria-expanded", String(ouvert));
      menuBouton.setAttribute("aria-label", ouvert ? "Fermer le menu" : "Ouvrir le menu");
    };
    menuBouton.addEventListener("click", function () { regler(!menu.classList.contains("ouvert")); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) regler(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") regler(false); });
    document.addEventListener("click", function (e) { if (!e.target.closest(".entete")) regler(false); });
  }

  // ---------- 2. Apparitions ----------
  const blocs = Array.prototype.slice.call(document.querySelectorAll(".apparait"));
  blocs.forEach(function (el) {
    // décalage entre voisins d'un même parent (tuiles, étapes)
    const freres = Array.prototype.filter.call(el.parentElement.children, function (f) { return f.classList.contains("apparait"); });
    const rang = freres.indexOf(el);
    if (rang > 0) el.style.setProperty("--d", Math.min(rang, 4) * 0.12 + "s");
  });
  if (!io || reduit) {
    blocs.forEach(function (el) { el.classList.add("vu"); });
  } else {
    const vue = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("vu"); vue.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    blocs.forEach(function (el) { vue.observe(el); });
  }

  // ---------- 3. Lien vers une question ----------
  const ouvrir = function () {
    if (!/^#q-/.test(location.hash)) return;
    const q = document.querySelector(location.hash);
    if (q && q.tagName === "DETAILS") q.open = true;
  };
  window.addEventListener("hashchange", ouvrir);
  document.addEventListener("click", function (e) {
    const a = e.target.closest('a[href^="#q-"]');
    if (!a) return;
    const q = document.querySelector(a.getAttribute("href"));
    if (q && q.tagName === "DETAILS") q.open = true;
  });
  ouvrir();

  // ---------- 4. Haut de page qui suit le défilement ----------
  const scene = document.querySelector("[data-scene]");
  if (scene && !reduit) {
    let attente = false;
    const suivre = function () {
      attente = false;
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.8)));
      scene.style.setProperty("--p", p.toFixed(3));
    };
    window.addEventListener("scroll", function () {
      if (!attente) { attente = true; requestAnimationFrame(suivre); }
    }, { passive: true });
    suivre();
  }

  // ---------- 5. La nouvelle ère ----------
  // p (0 → 1) : avancement dans la section haute. Les outils apparaissent l'un après l'autre (--a),
  // les phrases s'enchaînent (data-de / data-a), puis les outils convergent (--m) et Cosmo apparaît (--c).
  const ere = document.querySelector("[data-ere]");
  if (ere && !reduit) {
    const apps = Array.prototype.slice.call(ere.querySelectorAll(".app"));
    const lignes = Array.prototype.slice.call(ere.querySelectorAll(".ere-ligne"));
    const borne = function (x) { return Math.min(1, Math.max(0, x)); };
    let attenteEre = false;
    const suivreEre = function () {
      attenteEre = false;
      const total = ere.offsetHeight - window.innerHeight;
      const p = total > 0 ? borne(-ere.getBoundingClientRect().top / total) : 1;
      apps.forEach(function (a, i) { a.style.setProperty("--a", borne((p - i * 0.012) / 0.08).toFixed(3)); });
      const m = borne((p - 0.48) / 0.22);
      ere.style.setProperty("--m", (m * m * (3 - 2 * m)).toFixed(3));
      // les bulles de verre s'effacent pendant que les gouttes sortent d'elles et filent dessiner le logo
      ere.style.setProperty("--t", (1 - borne((m - 0.2) / 0.4)).toFixed(3));
      ere.style.setProperty("--g", borne((m - 0.05) / 0.4).toFixed(3));
      // les gouttes fondues deviennent le logo net
      ere.style.setProperty("--c", borne((p - 0.72) / 0.08).toFixed(3));
      lignes.forEach(function (l) {
        l.classList.toggle("est-la", p >= Number(l.dataset.de) && p < Number(l.dataset.a));
      });
    };
    window.addEventListener("scroll", function () {
      if (!attenteEre) { attenteEre = true; requestAnimationFrame(suivreEre); }
    }, { passive: true });
    window.addEventListener("resize", suivreEre);
    suivreEre();
  } else if (ere) {
    ere.style.setProperty("--c", "1");
  }

  // ---------- 5 ter. Ce que coûtent les autres logiciels ----------
  // p (0 → 1) suit le défilement de la section. Trois temps :
  //   a (0 → .44)  : les cinq logiciels montent un par un, comme des bulles, chacune avec son prix ;
  //   b (.44 → .72) : un trait de lumière barre chaque bulle, elle éclate en gouttes ;
  //   c (.72 → 1)  : « Des milliers d'euros perdus. Cosmo les remplace tous. »
  // La boucle d'images ne tourne que quand la section est à l'écran (les bulles flottent sans arrêt).
  const eco = document.querySelector("[data-eco]");
  if (eco && io && !reduit) {
    const borne = function (x) { return Math.min(1, Math.max(0, x)); };
    const sortie = function (x) { return 1 - Math.pow(1 - x, 4); };   // arrivée qui freine
    const cartes = Array.prototype.slice.call(eco.querySelectorAll(".eco-carte"));
    const lignesEco = Array.prototype.slice.call(eco.querySelectorAll(".eco-ligne"));
    const monde = eco.querySelector(".eco-monde");
    cartes.forEach(function (c, i) { c.querySelector(".eco-bulle").style.setProperty("--i", i); });

    // Où se posent les bulles : en vague sur ordinateur, en 2-1-2 sur téléphone
    let places = [];
    const placer = function () {
      const l = window.innerWidth, h = window.innerHeight;
      places = l >= 900
        ? [[-0.34, 0.03], [-0.17, 0.2], [0, 0.0], [0.17, 0.2], [0.34, 0.03]].map(function (q) { return { x: q[0] * Math.min(l, 1500), y: q[1] * h }; })
        : [[-0.25, -0.06], [0.25, -0.06], [0, 0.1], [-0.25, 0.26], [0.25, 0.26]].map(function (q) { return { x: q[0] * Math.max(l, 340), y: q[1] * h }; });
    };
    placer();
    window.addEventListener("resize", placer);

    let visible = false;
    let phase = "";
    const image = function (t) {
      if (!visible) return;
      const r = eco.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = borne(-r.top / (eco.offsetHeight - vh));
      const s = t / 1000;

      let eclat = 0;
      cartes.forEach(function (c, i) {
        const pl = places[i];
        const a = sortie(borne((p - (0.04 + i * 0.06)) / 0.12));          // la bulle monte
        const d0 = 0.45 + i * 0.05;
        const sl = borne((p - d0) / 0.022);                                // le trait qui la barre
        const e = sortie(borne((p - d0 - 0.026) / 0.05));                  // elle éclate
        eclat = Math.max(eclat, e * (1 - e) * 4);
        // en montant, elle ondule ; une fois posée, elle flotte
        const x = pl.x + Math.sin(a * 6 + i) * 24 * (1 - a) + Math.cos(s * 0.7 + i) * 5 * a;
        const y = pl.y + (1 - a) * vh * 0.65 + Math.sin(s * 0.9 + i * 1.7) * 8 * a;
        const z = -380 * (1 - a);
        c.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px," + z.toFixed(1) + "px) scale(" + (0.6 + 0.4 * a).toFixed(3) + ")";
        c.style.opacity = Math.min(1, a * 1.8).toFixed(3);
        c.style.setProperty("--sl", sl.toFixed(3));
        c.style.setProperty("--e", e.toFixed(3));
      });

      const ph = p < 0.44 ? "a" : p < 0.72 ? "b" : "c";
      if (ph !== phase) { eco.dataset.phase = ph; phase = ph; }
      lignesEco.forEach(function (l) { l.classList.toggle("est-la", p >= Number(l.dataset.de) && p < Number(l.dataset.a)); });

      // caméra : une lente poussée ; halo qui s'allume à chaque éclatement, puis une fois à la fin
      const fin = sortie(borne((p - 0.72) / 0.12));
      monde.style.transform = "translateZ(" + (p * 50).toFixed(1) + "px) rotateX(" + ((0.5 - p) * 4).toFixed(2) + "deg)";
      eco.style.setProperty("--h", (0.3 + eclat * 0.3 + fin * 0.4 + Math.sin(borne((p - 0.74) / 0.1) * Math.PI) * 0.25).toFixed(3));
      eco.style.setProperty("--rai", (100 - borne((p - 0.78) / 0.1) * 100).toFixed(1) + "%");

      requestAnimationFrame(image);
    };
    new IntersectionObserver(function (e) {
      const avant = visible;
      visible = e[0].isIntersecting;
      if (visible && !avant) requestAnimationFrame(image);
    }).observe(eco);
  } else if (eco) {
    eco.dataset.phase = "c";
  }

  // ---------- 5 bis. Compteur d'économies (s'il est à l'écran, il monte de 0 au montant) ----------
  Array.prototype.forEach.call(document.querySelectorAll("[data-compteur]"), function (el) {
    const fin = Number(el.dataset.compteur);
    if (reduit || !io) { el.textContent = fin.toLocaleString("fr-FR"); return; }
    const obs = new IntersectionObserver(function (entrees) {
      if (!entrees[0].isIntersecting) return;
      obs.disconnect();
      const debut = performance.now() + 700;
      const duree = 1600;
      const pas = function (t) {
        const x = Math.min(1, Math.max(0, (t - debut) / duree));
        el.textContent = Math.round(fin * (1 - Math.pow(1 - x, 3))).toLocaleString("fr-FR");
        if (x < 1) requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
    }, { threshold: 0.6 });
    obs.observe(el);
  });

  // ---------- 6. Questions : la réponse s'ouvre et se ferme en douceur ----------
  Array.prototype.forEach.call(document.querySelectorAll(".faq details"), function (d) {
    const resume = d.querySelector("summary");
    const reponse = d.querySelector(".faq-reponse");
    if (!resume || !reponse || reduit || !reponse.animate) return;
    let anim = null;
    resume.addEventListener("click", function (e) {
      e.preventDefault();
      if (anim) anim.cancel();
      if (!d.open) {
        d.open = true;
        const h = reponse.scrollHeight;
        anim = reponse.animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: 380, easing: "cubic-bezier(.22,.8,.24,1)" });
      } else {
        const h = reponse.offsetHeight;
        anim = reponse.animate([{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 280, easing: "ease" });
        anim.onfinish = function () { d.open = false; };
      }
      reponse.style.overflow = "hidden";
      anim.addEventListener("finish", function () { reponse.style.overflow = ""; anim = null; });
    });
  });
})();
