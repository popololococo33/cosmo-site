// Réserver une démo — Cosmo par Cosmosoft
//
// LES TROIS RÉGLAGES DU SITE SONT ICI :
//
// ADRESSE_CALENDLY : le lien de la page Calendly de la démo, par exemple
//   "https://calendly.com/cosmosoft/demo-cosmo". Tant qu'il est vide, le bloc final affiche
//   le formulaire de demande de démo. Dès qu'il est rempli, le calendrier Calendly le remplace
//   (chargé seulement quand le bloc approche de l'écran).
// ADRESSE_DEMANDE : adresse qui reçoit la demande de démo en POST JSON (par exemple une fonction
//   Supabase). Tant qu'elle est vide, le bouton ouvre un e-mail prérempli vers ADRESSE_CONTACT :
//   rien n'est envoyé sans le visiteur.
// DUREE_DEMO : la durée affichée sous les boutons, par exemple "20 minutes en visio".
//   Vide : aucune durée n'est promise.
//
// Voir README.md, « Réserver une démo ».

const ADRESSE_CALENDLY = "https://calendly.com/cosmosoft/demo-cosmo";
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
  const boiteCalendly = document.getElementById("calendly");

  // ---------- Calendly ----------
  // Paramètres ajoutés au lien : couleur de marque (primary_color, prise en compte seulement
  // avec une offre payante de Calendly) et provenance (utm_source, utm_medium).
  // Pas de hide_gdpr_banner : le bandeau cookies de Calendly est le seul moyen de recueillir
  // l'accord du visiteur pour les cookies de Calendly, ce site n'ayant pas de bandeau à lui.
  function adresseCalendly() {
    let u;
    try { u = new URL(ADRESSE_CALENDLY); } catch (e) { return ""; }
    if (!/(^|\.)calendly\.com$/.test(u.hostname)) return "";
    u.searchParams.set("primary_color", "ff5a1f");
    u.searchParams.set("utm_source", "site");
    u.searchParams.set("utm_medium", "cta");
    return u.toString();
  }

  const lienCalendly = ADRESSE_CALENDLY ? adresseCalendly() : "";
  if (lienCalendly && boiteCalendly) {
    if (form) form.hidden = true;
    boiteCalendly.hidden = false;
    const widget = document.createElement("div");
    widget.className = "calendly-inline-widget";
    widget.setAttribute("data-url", lienCalendly);
    boiteCalendly.appendChild(widget);
    // Secours si le calendrier ne se charge pas (bloqueur, pas de réseau)
    const secours = document.createElement("p");
    secours.className = "calendly-secours";
    secours.innerHTML = "Le calendrier ne s'affiche pas&nbsp;? <a href=\"" + lienCalendly + "\" target=\"_blank\" rel=\"noopener\">Ouvrir la page de réservation</a>.";
    boiteCalendly.appendChild(secours);

    let charge = false;
    const charger = function () {
      if (charge) return;
      charge = true;
      const s = document.createElement("script");
      s.src = "https://assets.calendly.com/assets/external/widget.js";
      s.async = true;
      document.body.appendChild(s);
    };
    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) { charger(); obs.disconnect(); }
      }, { rootMargin: "800px 0px" });
      obs.observe(boiteCalendly);
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
