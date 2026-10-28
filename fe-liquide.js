// « La facture électronique devient obligatoire » : l'aller-retour en verre liquide, piloté par le défilement (WebGL)
//
// Le schéma (.fe-scene) reste fixe pendant qu'on fait défiler la piste (.fe-piste). L'avancement pilote tout :
//   RECEVOIR (0 → 0,5) : une mini-bulle se détache de « Votre fournisseur », glisse sur le fil, fond dans la
//                        plateforme ; puis une autre part de la plateforme et fond dans « Vous » (obligatoire depuis 2026).
//   ENVOYER  (0,5 → 1) : le même chemin à l'envers, vers « Votre client » (obligatoire en 2027).
//   La phrase au-dessus (data-mode sur .fe-scene) et le nom de droite changent au milieu.
// Les trois bulles et la mini-bulle sont des distances signées (cercles) ; la mini-bulle est fondue aux autres par un
// minimum lissé, d'où le pont de liquide au départ et à l'arrivée. Le verre réfracte un fond doux (orange, lilas, bleu),
// le même que le halo du schéma. Icônes, textes et fil restent en HTML ; ce script lit leurs places à chaque image.
// Sans WebGL ou avec « réduire les animations », rien ne change : l'animation CSS en boucle reste.

(function () {
  const section = document.getElementById("facture-electronique");
  const piste = document.querySelector("[data-fe]");
  if (!section || !piste || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const scene = piste.querySelector(".fe-scene");
  const schema = piste.querySelector(".fe-schema");
  const icos = Array.prototype.slice.call(schema.querySelectorAll(".fe-ico"));
  const bulles = Array.prototype.slice.call(schema.querySelectorAll(".app-icone"));
  if (!scene || icos.length !== 3 || bulles.length !== 3) return;

  const toile = document.createElement("canvas");
  toile.className = "fe-toile";
  toile.setAttribute("aria-hidden", "true");
  const gl = toile.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true });
  if (!gl) return;

  const VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const FS = [
    "precision highp float;",
    "uniform vec2 uRes;uniform float uDpr,uTime,uK;uniform vec3 uB[3];uniform vec3 uM;uniform vec3 uG;",
    "float smin(float a,float b,float k){if(k<=.001)return min(a,b);float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}",
    "float cercle(vec2 p,vec3 b,float i){vec2 q=p-b.xy;float an=atan(q.y,q.x);",
    " return length(q)-b.z*(1.+.018*sin(3.*an+uTime*.9+i*1.7)+.012*sin(2.*an-uTime*1.3+i*2.3));}",
    "float dist(vec2 p){float d=min(min(cercle(p,uB[0],0.),cercle(p,uB[1],1.)),cercle(p,uB[2],2.));",
    " if(uM.z>0.)d=smin(d,length(p-uM.xy)-uM.z,uK);return d;}",
    // fond réfracté : blanc chaud teinté d'orange (vous), de lilas (la plateforme), de bleu ciel (clients)
    "vec3 fond(vec2 p){vec3 c=vec3(.985,.985,.99);float r=uB[1].z*3.;",
    " float w;w=exp(-dot(p-uB[0].xy,p-uB[0].xy)/(r*r));c=mix(c,vec3(1.,.68,.52),.55*w);",
    " w=exp(-dot(p-uB[1].xy,p-uB[1].xy)/(r*r));c=mix(c,vec3(.77,.68,1.),.5*w);",
    " w=exp(-dot(p-uB[2].xy,p-uB[2].xy)/(r*r));c=mix(c,vec3(.62,.83,1.),.5*w);return c;}",
    "void main(){vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;",
    " float d=dist(p);",
    // lueur orange autour de la bulle qui reçoit ou envoie, et ombre douce sous les bulles
    " float lueur=0.;",
    " lueur=max(lueur,uG.x*exp(-max(length(p-uB[0].xy)-uB[0].z,0.)/16.));",
    " lueur=max(lueur,uG.y*exp(-max(length(p-uB[1].xy)-uB[1].z,0.)/16.));",
    " lueur=max(lueur,uG.z*exp(-max(length(p-uB[2].xy)-uB[2].z,0.)/16.));",
    " float om=(1.-smoothstep(-6.,22.,dist(p-vec2(0.,9.))))*.09;",
    " vec3 coulDehors=vec3(1.,.42,.2);float aDehors=max(lueur*.55,0.);",
    " vec4 dehors=vec4(coulDehors*aDehors,aDehors);dehors=dehors+vec4(vec3(.16,.12,.3)*om,om)*(1.-dehors.a);",
    " vec4 res=dehors;",
    " if(d<1.){",
    "  vec2 g=vec2(dist(p+vec2(1.,0.))-d,dist(p+vec2(0.,1.))-d);g=normalize(g+1e-6);",
    "  float R=uB[1].z;float prof=clamp(-d/max(R*.7,1.),0.,1.);float bord=pow(1.-prof,2.2);",
    "  vec3 n=normalize(vec3(g*bord*1.7,1.));",
    "  vec3 verre=fond(p+n.xy*R*.5)+.02;",
    "  float rim=pow(1.-n.z,1.6);",
    "  float spec=pow(max(dot(n,normalize(vec3(-.45,-.6,.66))),0.),36.);",
    "  float eclat=pow(max(dot(n,normalize(vec3(.5,.55,.67))),0.),60.);",
    "  verre+=rim*.38+spec*.85+eclat*.45;",
    "  float cov=smoothstep(.75,-.75,d);",
    "  res=vec4(verre,1.)*cov+dehors*(1.-cov);}",
    " gl_FragColor=res;}"
  ].join("\n");

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  const vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ["uRes", "uDpr", "uTime", "uK", "uB", "uM", "uG"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  schema.insertBefore(toile, schema.firstChild);
  // la facture qui voyage : l'icône du document, posée sur la mini-bulle
  const mini = document.createElement("span");
  mini.className = "fe-mini";
  mini.setAttribute("aria-hidden", "true");
  mini.innerHTML = '<svg><use href="#o-devis"/></svg>';
  schema.appendChild(mini);
  section.classList.add("fe-gl");

  const borne = function (x) { return Math.min(1, Math.max(0, x)); };
  const doux = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const etape = function (p, a, b) { return borne((p - a) / (b - a)); };
  // un pic autour de l'instant e (largeur l) : la lueur d'une bulle quand la mini-bulle la quitte ou l'atteint
  const pic = function (p, e, l) { const x = (p - e) / l; return Math.exp(-x * x); };

  // les quatre trajets (0 : vous, 1 : la plateforme, 2 : fournisseur ou client) : la réception, puis l'envoi
  const trajets = [
    { de: 2, a: 1, debut: .06, fin: .24 },
    { de: 1, a: 0, debut: .28, fin: .46 },
    { de: 0, a: 1, debut: .54, fin: .72 },
    { de: 1, a: 2, debut: .76, fin: .94 }
  ];

  let L = 0, H = 0, dpr = 1;
  function cadrer() {
    L = toile.clientWidth;
    H = toile.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    toile.width = Math.round(L * dpr);
    toile.height = Math.round(H * dpr);
    gl.viewport(0, 0, toile.width, toile.height);
  }

  const B = new Float32Array(9);
  const encre = [29, 29, 31], orange = [232, 80, 26];
  let visible = false, boucle = 0, pL = -1, avant = 0, mode = "reception";

  function image(t) {
    boucle = visible ? requestAnimationFrame(image) : 0;
    const dt = avant ? Math.min(.05, (t - avant) / 1000) : .016;
    avant = t;
    if (L !== toile.clientWidth || H !== toile.clientHeight) cadrer();
    if (!L || !H) return;

    const total = piste.offsetHeight - window.innerHeight;
    const p = total > 0 ? borne(-piste.getBoundingClientRect().top / total) : 0;
    // le défilement est suivi avec un léger amorti : même une molette par crans donne un mouvement continu
    pL = pL < 0 ? p : pL + (p - pL) * (1 - Math.exp(-dt * 8));

    // les bulles, à leur place réelle dans la page (centre des icônes HTML)
    const base = toile.getBoundingClientRect();
    const centres = icos.map(function (el, i) {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2 - base.left, r.top + r.height / 2 - base.top, bulles[i].offsetWidth / 2];
    });
    // la mini-bulle du trajet en cours
    let m = [0, 0, -1], k = 0, voit = 0;
    trajets.forEach(function (tr) {
      const x = etape(pL, tr.debut, tr.fin);
      if (x <= 0 || x >= 1) return;
      const e = doux(x), A = centres[tr.de], Bb = centres[tr.a];
      const rm = A[2] * .46;
      m = [A[0] + (Bb[0] - A[0]) * e, A[1] + (Bb[1] - A[1]) * e, rm];
      k = rm * 1.5;
      // l'icône se montre une fois la bulle détachée, et s'efface quand elle fond dans l'autre
      voit = borne((x - .12) / .14) * (1 - borne((x - .78) / .14));
      // la bulle de départ cède un peu de liquide, celle d'arrivée en reçoit
      const cede = Math.sin(Math.PI * Math.min(1, x * 1.6)) * .07;
      const recoit = Math.sin(Math.PI * Math.max(0, (x - .55) / .45)) * .07;
      centres[tr.de] = [A[0], A[1], A[2] * (1 - cede)];
      centres[tr.a] = [Bb[0], Bb[1], Bb[2] * (1 + recoit)];
    });
    // la toile déborde de 40 px autour du schéma : on recale l'icône dans le repère du schéma
    if (voit > 0.01) {
      const taille = m[2] * 1.05;
      mini.style.transform = "translate(" + (m[0] - 40 - 15).toFixed(1) + "px," + (m[1] - 40 - 15).toFixed(1) + "px) scale(" + (taille / 30).toFixed(3) + ")";
      mini.style.opacity = voit.toFixed(3);
    } else if (mini.style.opacity !== "0") {
      mini.style.opacity = "0";
    }
    for (let i = 0; i < 3; i++) { B[i * 3] = centres[i][0]; B[i * 3 + 1] = centres[i][1]; B[i * 3 + 2] = centres[i][2]; }

    // les lueurs : au départ et à l'arrivée de chaque trajet
    const g = [0, 0, 0];
    trajets.forEach(function (tr) {
      g[tr.de] = Math.max(g[tr.de], pic(pL, tr.debut + .01, .035));
      g[tr.a] = Math.max(g[tr.a], pic(pL, tr.fin, .045));
    });
    bulles.forEach(function (b, i) {
      const c = encre.map(function (v, j) { return Math.round(v + (orange[j] - v) * g[i]); });
      b.style.color = "rgb(" + c.join(",") + ")";
    });

    const m2 = pL < .5 ? "reception" : "envoi";
    if (m2 !== mode) { mode = m2; scene.setAttribute("data-mode", mode); }

    gl.uniform2f(U.uRes, L, H);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uTime, t / 1000);
    gl.uniform1f(U.uK, k);
    gl.uniform3fv(U.uB, B);
    gl.uniform3f(U.uM, m[0], m[1], m[2]);
    gl.uniform3f(U.uG, g[0], g[1], g[2]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  new IntersectionObserver(function (e) {
    visible = e[0].isIntersecting;
    if (visible && !boucle) { avant = 0; boucle = requestAnimationFrame(image); }
  }).observe(piste);
  window.addEventListener("resize", cadrer);
  cadrer();
})();
