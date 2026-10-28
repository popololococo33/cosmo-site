// Réserver une démo — Cosmo par Cosmosoft
//
// LES TROIS RÉGLAGES DU SITE SONT ICI :
//
// LIEN_CAL : le rendez-vous Cal.com de la démo, sous la forme « compte/rendez-vous »
//   (aujourd'hui cal.com/cosmosoft/demo-cosmo). Tant qu'il est vide, le bloc final affiche
//   le formulaire de demande de démo. Dès qu'il est rempli, le calendrier Cal.com le remplace,
//   aux couleurs de Cosmo, chargé un peu avant que le bloc arrive à l'écran.
// ADRESSE_DEMANDE : adresse qui reçoit la demande de démo en POST JSON (par exemple une fonction
//   Supabase). Tant qu'elle est vide, le bouton ouvre un e-mail prérempli vers ADRESSE_CONTACT :
//   rien n'est envoyé sans le visiteur.
// DUREE_DEMO : la durée affichée sous les boutons, par exemple "20 minutes en visio".
//   Vide : aucune durée n'est promise.
//
// Voir README.md, « Réserver une démo ».

const LIEN_CAL = "cosmosoft/demo-cosmo";
const ADRESSE_DEMANDE = "";
const ADRESSE_CONTACT = "contact@cosmosoft.fr";
const DUREE_DEMO = "30 minutes en visio";

(function () {
  "use strict";

  // ---------- Durée de la démo (haut de page et bloc final) ----------
  if (DUREE_DEMO) {
    document.querySelectorAll("[data-duree]").forEach(function (el) {
      el.querySelector(".duree-texte").textContent = DUREE_DEMO;
      el.hidden = false;
    });
  }

  const form = document.getElementById("formulaire-demo");
  const boiteAgenda = document.getElementById("agenda");

  // ---------- Cal.com ----------
  // Le calendrier s'affiche dans la page (thème clair, vue par mois, orange de Cosmo).
  // Le script de Cal.com n'est chargé qu'à l'approche du bloc (1 500 px avant) : le haut de page
  // reste léger, et le calendrier est déjà prêt quand on arrive dessus.
  const lienCal = /^[\w-]+\/[\w-]+$/.test(LIEN_CAL) ? LIEN_CAL : "";
  if (lienCal && boiteAgenda) {
    if (form) form.hidden = true;
    boiteAgenda.hidden = false;
    boiteAgenda.classList.add("chargement");
    const zone = document.createElement("div");
    zone.className = "agenda-cal";
    zone.id = "agenda-cal";
    boiteAgenda.appendChild(zone);
    // Secours si le calendrier ne se charge pas (bloqueur, pas de réseau)
    const secours = document.createElement("p");
    secours.className = "agenda-secours";
    secours.innerHTML = "Le calendrier ne s'affiche pas&nbsp;? <a href=\"https://cal.com/" + lienCal + "\" target=\"_blank\" rel=\"noopener\">Ouvrir la page de réservation</a>.";
    boiteAgenda.appendChild(secours);

    let charge = false;
    const charger = function () {
      if (charge) return;
      charge = true;
      // amorce officielle de Cal.com : met les appels en file jusqu'à l'arrivée de embed.js
      (function (C, A, L) {
        const p = function (a, ar) { a.q.push(ar); };
        const d = C.document;
        C.Cal = C.Cal || function () {
          const cal = C.Cal;
          const ar = arguments;
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            d.head.appendChild(d.createElement("script")).src = A;
            cal.loaded = true;
          }
          if (ar[0] === L) {
            const api = function () { p(api, arguments); };
            const ns = ar[1];
            api.q = api.q || [];
            if (typeof ns === "string") {
              cal.ns[ns] = cal.ns[ns] || api;
              p(cal.ns[ns], ar);
              p(cal, ["initNamespace", ns]);
            } else p(cal, ar);
            return;
          }
          p(cal, ar);
        };
      })(window, "https://app.cal.com/embed/embed.js", "init");
      window.Cal("init", "demo", { origin: "https://app.cal.com" });
      window.Cal.ns.demo("inline", {
        elementOrSelector: "#agenda-cal",
        calLink: lienCal,
        config: { layout: "month_view", theme: "light" }
      });
      window.Cal.ns.demo("ui", {
        theme: "light",
        layout: "month_view",
        hideEventTypeDetails: false,
        cssVarsPerTheme: { light: { "cal-brand": "#FF5A1F" }, dark: { "cal-brand": "#FF5A1F" } }
      });
      // une fois le calendrier prêt, la ligne de secours n'a plus lieu d'être
      window.Cal.ns.demo("on", { action: "linkReady", callback: function () { secours.hidden = true; boiteAgenda.classList.remove("chargement"); } });
    };
    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) { charger(); obs.disconnect(); }
      }, { rootMargin: "1500px 0px" });
      obs.observe(boiteAgenda);
    } else {
      charger();
    }
    return;
  }

  // ---------- Formulaire de demande de démo ----------
  if (!form) return;

  const champs = {
    email: form.querySelector("#email"),
    metier: form.querySelector("#metier"),
    autre: form.querySelector("#metier-autre"),
    prenom: form.querySelector("#prenom"),
    telephone: form.querySelector("#telephone"),
    creneau: form.querySelector("#creneau"),
    consentement: form.querySelector("#consentement"),
    piege: form.querySelector("#site-web")
  };
  const blocAutre = document.getElementById("champ-autre");
  const message = document.getElementById("message-demo");
  const bouton = form.querySelector('button[type="submit"]');
  const libelleBouton = bouton.textContent;

  // « Autre » : un champ libre apparaît
  champs.metier.addEventListener("change", function () {
    const autre = champs.metier.value === "Autre";
    blocAutre.hidden = !autre;
    champs.autre.required = autre;
    if (autre) champs.autre.focus();
  });

  // Une erreur s'efface dès que le champ change
  [["email", "erreur-email"], ["metier", "erreur-metier"], ["autre", "erreur-autre"], ["consentement", "erreur-consentement"]]
    .forEach(function (c) {
      ["input", "change"].forEach(function (ev) {
        champs[c[0]].addEventListener(ev, function () {
          document.getElementById(c[1]).hidden = true;
          champs[c[0]].removeAttribute("aria-invalid");
        });
      });
    });

  function erreur(champ, idErreur, visible) {
    document.getElementById(idErreur).hidden = !visible;
    champ.setAttribute("aria-invalid", visible ? "true" : "false");
    return visible;
  }

  function valider() {
    const email = champs.email.value.trim();
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    const fautes = [
      erreur(champs.email, "erreur-email", !okEmail) && champs.email,
      erreur(champs.metier, "erreur-metier", !champs.metier.value) && champs.metier,
      erreur(champs.autre, "erreur-autre", champs.metier.value === "Autre" && !champs.autre.value.trim()) && champs.autre,
      erreur(champs.consentement, "erreur-consentement", !champs.consentement.checked) && champs.consentement
    ].filter(Boolean);
    if (fautes.length) fautes[0].focus();
    return fautes.length === 0;
  }

  function donnees() {
    const metier = champs.metier.value === "Autre"
      ? "Autre : " + champs.autre.value.trim()
      : champs.metier.value;
    return {
      type: "demande-demo",
      email: champs.email.value.trim(),
      metier: metier,
      prenom: champs.prenom.value.trim(),
      telephone: champs.telephone.value.trim(),
      creneau: champs.creneau.value.trim(),
      consentement: true,
      date: new Date().toISOString(),
      page: location.pathname
    };
  }

  function afficher(html) {
    message.innerHTML = html;
    message.hidden = false;
    message.focus();
  }

  function texte(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function lienEmail(d) {
    const corps = [
      "Bonjour,",
      "",
      "Je souhaite voir Cosmo en démo.",
      "",
      d.prenom ? "Prénom : " + d.prenom : null,
      "E-mail : " + d.email,
      d.telephone ? "Téléphone : " + d.telephone : null,
      "Métier : " + d.metier,
      d.creneau ? "Créneau qui m'arrange : " + d.creneau : null,
      "",
      "J'accepte que Cosmosoft utilise ces informations pour organiser la démo et me recontacter à son sujet."
    ].filter(function (l) { return l !== null; }).join("\n");
    return "mailto:" + ADRESSE_CONTACT
      + "?subject=" + encodeURIComponent("Demande de démo Cosmo")
      + "&body=" + encodeURIComponent(corps);
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    message.hidden = true;
    if (champs.piege.value) return; // robot
    if (!valider()) return;

    const d = donnees();

    // Pas encore de serveur : e-mail prérempli
    if (!ADRESSE_DEMANDE) {
      const lien = lienEmail(d);
      afficher(
        "<p><strong>Il reste une étape : envoyer l'e-mail.</strong></p>"
        + "<p>Votre messagerie s'ouvre avec un e-mail prêt pour " + texte(ADRESSE_CONTACT) + ". "
        + "Envoyez-le tel quel : nous vous recontactons pour fixer la démo.</p>"
        + "<p>Rien ne s'ouvre ? <a href=\"" + lien + "\">Ouvrir l'e-mail</a>, "
        + "ou écrivez-nous à <a href=\"mailto:" + ADRESSE_CONTACT + "\">" + texte(ADRESSE_CONTACT) + "</a>.</p>"
      );
      window.location.href = lien;
      return;
    }

    bouton.disabled = true;
    bouton.textContent = "Envoi…";
    try {
      const r = await fetch(ADRESSE_DEMANDE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d)
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      form.reset();
      blocAutre.hidden = true;
      afficher(
        "<p><strong>C'est noté, merci" + (d.prenom ? " " + texte(d.prenom) : "") + " !</strong></p>"
        + "<p>Nous vous recontactons à " + texte(d.email) + " pour fixer la démo.</p>"
      );
    } catch (err) {
      afficher(
        "<p><strong>La demande n'est pas partie.</strong></p>"
        + "<p>Vérifiez votre connexion et réessayez. Si cela ne passe toujours pas, "
        + "<a href=\"" + lienEmail(d) + "\">envoyez-nous un e-mail prérempli</a>.</p>"
      );
    } finally {
      bouton.disabled = false;
      bouton.textContent = libelleBouton;
    }
  });
})();
