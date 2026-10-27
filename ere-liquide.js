// « Une nouvelle ère » en verre liquide (WebGL)
//
// Les dix bulles sont dessinées par un shader, pas en CSS : chaque bulle est une distance signée (un cercle
// qui ondule un peu). Au défilement, elles glissent en tourbillon vers le tracé du logo, fondent entre elles
// (minimum lissé), puis la forme se resserre exactement sur le C et le point, et le verre devient de l'encre
// et de l'orange. Le fond chaud est calculé dans le shader : le verre le réfracte vraiment.
// Les icônes et les noms restent en HTML, posés sur les bulles (ce script les place à chaque image).
// Sans WebGL ou avec « réduire les animations », rien ne change : la version CSS d'origine reste.

(function () {
  const ere = document.querySelector("[data-ere]");
  if (!ere || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const scene = ere.querySelector(".ere-scene");
  const apps = Array.prototype.slice.call(ere.querySelectorAll(".app"));
  const gouttes = Array.prototype.slice.call(ere.querySelectorAll(".goutte"));
  if (!scene || apps.length !== 10 || gouttes.length !== 10) return;

  const toile = document.createElement("canvas");
  toile.className = "ere-toile";
  toile.setAttribute("aria-hidden", "true");
  const gl = toile.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" });
  if (!gl) return;

  const VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const FS = [
    "precision highp float;",
    "uniform vec2 uRes;uniform float uDpr,uTime,uMerge,uMorph,uInk,uGlow,uR,uS,uWob;",
    "uniform vec4 uB[10];uniform vec2 uCc,uDot;uniform vec4 uBlob[4];",
    "const vec3 ENCRE=vec3(.114,.114,.122);const vec3 ORANGE=vec3(1.,.416,.2);",
    "float smin(float a,float b,float k){if(k<=.001)return min(a,b);float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}",
    // le C du logo : un anneau ouvert à droite (bouts coupés droit, comme le dessin d'origine)
    "float sdC(vec2 p){p-=uCc;p.y=abs(p.y);float rm=52.*uS,th=13.*uS;vec2 dir=vec2(.6871,.7266);",
    " float side=dir.x*p.y-dir.y*p.x;float dr=abs(length(p)-rm)-th;if(side>0.)return max(dr,-side);",
    " vec2 a=dir*(rm-th),b=dir*(rm+th),pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}",
    "float bulle(vec2 p,vec4 b,float i){vec2 q=p-b.xy;float an=atan(q.y,q.x);",
    " float w=1.+uWob*(.02*sin(3.*an+uTime*.9+i*1.7)+.014*sin(2.*an-uTime*1.3+i*2.3));return length(q)-b.z*w;}",
    "void forme(vec2 p,out float dC,out float dD){float c=1e5;",
    " for(int i=0;i<10;i++){if(i==4)continue;c=smin(c,bulle(p,uB[i],float(i)),uMerge);}",
    " dC=mix(c,sdC(p),uMorph);dD=mix(bulle(p,uB[4],4.),length(p-uDot)-20.*uS,uMorph);}",
    "float dist(vec2 p){float a,b;forme(p,a,b);return smin(a,b,uMerge*(1.-uMorph));}",
    // le fond : les quatre lueurs floues de la version CSS (orange, lilas, bleu ciel, rose), mêmes places, mêmes dérives
    "float tache(vec2 p,vec4 b){return b.w*(1.-smoothstep(b.z-90.,b.z+90.,length(p-b.xy)));}",
    "vec3 fond(vec2 p){vec3 c=vec3(.984,.984,.992);",
    " c=mix(c,vec3(1.,.682,.522),tache(p,uBlob[0]));c=mix(c,vec3(.769,.682,1.),tache(p,uBlob[1]));",
    " c=mix(c,vec3(.616,.827,1.),tache(p,uBlob[2]));c=mix(c,vec3(1.,.839,.91),tache(p,uBlob[3]));return c;}",
    "void main(){vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;",
    " float dC,dD;forme(p,dC,dD);float d=smin(dC,dD,uMerge*(1.-uMorph));",
    " vec3 bg=fond(p);",
    // ombre douce sous les bulles, qui devient la lueur orange du logo
    " vec2 po=p-vec2(0.,12.*uS);float om=0.;\n for(int i=0;i<10;i++){float a=uB[i].w;om=max(om,a*(1.-smoothstep(-8.*a,30.*uS*a+.01,bulle(po,uB[i],float(i)))));}\n if(uMerge>.01)om=1.-smoothstep(-8.,30.*uS,dist(po));",
    " vec3 dehors=mix(bg*(1.-.13*om*(1.-uInk)),mix(bg,vec3(1.,.55,.32),.3*om),uGlow);",
    " vec3 dedans=dehors;",
    " if(d<1.){",
    "  vec2 g=vec2(dist(p+vec2(1.,0.))-d,dist(p+vec2(0.,1.))-d);g=normalize(g+1e-6);",
    "  float prof=clamp(-d/max(uR,1.),0.,1.);float bord=pow(1.-prof,2.2);",
    "  vec3 n=normalize(vec3(g*bord*1.7,1.));",
    "  vec3 verre=fond(p+n.xy*30.*uS)+.018;",
    "  float rim=pow(1.-n.z,1.6);",
    "  float spec=pow(max(dot(n,normalize(vec3(-.45,-.6,.66))),0.),36.);",
    "  float eclat=pow(max(dot(n,normalize(vec3(.5,.55,.67))),0.),60.);",
    "  verre+=rim*.36+spec*.8+eclat*.45;",
    "  float sD=smoothstep(-6.,6.,dC-dD);vec3 plein=mix(ENCRE,ORANGE,sD);",
    "  plein+=(spec*.5+rim*.12)*(1.-uInk);",
    "  dedans=mix(verre,plein,uInk);}",
    " float cov=smoothstep(.75,-.75,d);gl_FragColor=vec4(mix(dehors,dedans,cov),1.);}"
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
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ["uRes", "uDpr", "uTime", "uMerge", "uMorph", "uInk", "uGlow", "uR", "uS", "uWob", "uB", "uCc", "uDot", "uBlob"].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });

  // Les positions de départ (en % de la scène) et d'arrivée (en unités du logo) sont déjà dans le HTML
  const lire = function (el, nom) { return parseFloat(el.style.getPropertyValue(nom)); };
  const depart = apps.map(function (a) { return [lire(a, "--x"), lire(a, "--y")]; });
  const arrivee = gouttes.map(function (g) { return [lire(g, "--tx"), lire(g, "--ty")]; });
  const retard = [0, .1, .05, .12, .03, .08, .14, .04, .11, .07];

  scene.insertBefore(toile, scene.firstChild);
  ere.classList.add("ere-gl");

  const borne = function (x) { return Math.min(1, Math.max(0, x)); };
  const lisse = function (x) { return x * x * (3 - 2 * x); };
  const doux = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const rebond = function (x) { const c = 1.5; return x <= 0 ? 0 : 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  let L = 0, H = 0, dpr = 1, tailles = [];
  function cadrer() {
    L = scene.clientWidth;
    H = scene.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    toile.width = Math.round(L * dpr);
    toile.height = Math.round(H * dpr);
    gl.viewport(0, 0, toile.width, toile.height);
    tailles = apps.map(function (a) {
      const ic = a.querySelector(".app-icone");
      return [a.offsetWidth, ic ? ic.offsetHeight : 0];
    });
  }

  let visible = false, boucle = 0, pL = -1, avant = 0;
  const B = new Float32Array(40);
  function image(t) {
    boucle = visible ? requestAnimationFrame(image) : 0;
    const dt = avant ? Math.min(.05, (t - avant) / 1000) : .016;
    avant = t;
    if (!L) cadrer();
    const total = ere.offsetHeight - window.innerHeight;
    const p = total > 0 ? borne(-ere.getBoundingClientRect().top / total) : 1;
    // le défilement est suivi avec un léger amorti : même une molette par crans donne un mouvement continu
    pL = pL < 0 ? p : pL + (p - pL) * (1 - Math.exp(-dt * 9));

    const large = window.innerWidth >= 700;
    const s = large ? 1.3 : .95, off = large ? 140 : 120, ex = large ? 1 : .8, R0 = large ? 44 : 33;
    const temps = t / 1000;
    const mBrut = borne((pL - .48) / .22);
    let somme = 0;
    for (let i = 0; i < 10; i++) {
      const a = rebond(borne((pL - i * .012) / .08));
      const e = doux(borne((mBrut - retard[i]) / .86));
      somme += e;
      const sx = L / 2 + depart[i][0] * ex * L / 100;
      const sy = H / 2 + depart[i][1] * H / 100 + Math.sin(temps * 1.2 + i * .9) * 6 * (1 - e);
      const tx = L / 2 + arrivee[i][0] * s, ty = H / 2 - off + arrivee[i][1] * s;
      // trajectoire en tourbillon : un écart perpendiculaire qui naît et s'éteint pendant le trajet
      const vx = tx - sx, vy = ty - sy, lg = Math.hypot(vx, vy) || 1;
      const tour = Math.sin(Math.PI * e) * lg * .2;
      const x = sx + vx * e - vy / lg * tour, y = sy + vy * e + vx / lg * tour;
      const rFin = i === 4 ? 20 * s : 13 * s * 1.3;
      // une bulle pas encore apparue a un rayon négatif : ni bulle, ni point, ni ombre
      B[i * 4] = x;
      B[i * 4 + 1] = y;
      B[i * 4 + 2] = a > 0 ? R0 * a * (1 + (rFin / R0 - 1) * Math.pow(e, 1.8)) : -4;
      B[i * 4 + 3] = Math.min(1, a);
      // l'icône et son nom suivent leur bulle, et rapetissent avec elle
      const tl = tailles[i] || [0, 0];
      const el = apps[i];
      el.style.transformOrigin = (tl[0] / 2) + "px " + (tl[1] / 2) + "px";
      el.style.transform = "translate(" + (x - tl[0] / 2).toFixed(1) + "px," + (y - tl[1] / 2).toFixed(1) + "px) scale(" + (1 - .55 * e).toFixed(3) + ")";
    }
    const eMoy = somme / 10;
    // mêmes taches que .ere-fond (boîte agrandie de 10 %, 44 vmax de large, animation « derive » en aller-retour)
    const vw = window.innerWidth / 100, vh = window.innerHeight / 100, vmax = Math.max(vw, vh);
    const x0 = -.1 * L, y0 = -.1 * H, bl = 1.2 * L, bh = 1.2 * H;
    const va = function (duree, inverse) { const k = (1 - Math.cos(Math.PI * temps / duree)) / 2; return inverse ? 1 - k : k; };
    const tache = function (cx, cy, r, k) { return [cx + 7 * vw * k, cy - 5 * vh * k, r * (1 + .18 * k), .75]; };
    const R = 22 * vmax, R4 = 15 * vmax;
    const blob = [].concat(
      tache(x0 + .06 * bl + R, y0 + .1 * bh + R, R, va(16)),
      tache(x0 + .96 * bl - R, y0 + .22 * bh + R, R, va(20, true)),
      tache(x0 + .28 * bl + R, y0 + .98 * bh - R, R, va(24)),
      tache(x0 + .74 * bl - R4, y0 + .02 * bh + R4, R4, va(19)));
    gl.uniform2f(U.uRes, L, H);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uTime, temps);
    gl.uniform1f(U.uS, s);
    gl.uniform1f(U.uWob, 1 - eMoy * .8);
    gl.uniform1f(U.uMerge, lisse(borne((mBrut - .3) / .55)) * 26 * s);
    gl.uniform1f(U.uMorph, lisse(borne((pL - .6) / .12)));
    gl.uniform1f(U.uInk, lisse(borne((pL - .64) / .12)));
    gl.uniform1f(U.uGlow, borne((pL - .72) / .08));
    gl.uniform1f(U.uR, R0 + (13 * s - R0) * Math.pow(eMoy, 1.8));
    gl.uniform4fv(U.uB, B);
    gl.uniform2f(U.uCc, L / 2 - 13 * s, H / 2 - off);
    gl.uniform2f(U.uDot, L / 2 + 45 * s, H / 2 - off);
    gl.uniform4fv(U.uBlob, new Float32Array(blob));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  new IntersectionObserver(function (e) {
    visible = e[0].isIntersecting;
    if (visible && !boucle) { avant = 0; boucle = requestAnimationFrame(image); }
  }).observe(ere);
  window.addEventListener("resize", function () { cadrer(); });
  cadrer();
})();
