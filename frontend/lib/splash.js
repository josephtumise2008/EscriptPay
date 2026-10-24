// App launch splash: CSS and timing live here and are inlined into the
// root layout <head>, so the splash paints with the very first HTML (no white
// flash while the stylesheet downloads). Shown only when EscriptPay is opened
// as an installed app, once per launch.
export const SPLASH_MS = 4000; // how long it stays before fading out
export const SPLASH_FADE_MS = 500;

export const SPLASH_SCRIPT = `try{var d=document.documentElement;var sa=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;if(sa&&!sessionStorage.getItem("ep-splash")){sessionStorage.setItem("ep-splash","1");var rm=window.matchMedia("(prefers-reduced-motion: reduce)").matches;var hold=rm?900:${SPLASH_MS};d.classList.add("ep-splash-on");var end=function(){d.classList.add("ep-splash-out");setTimeout(function(){d.classList.remove("ep-splash-on","ep-splash-out")},${SPLASH_FADE_MS})};setTimeout(end,hold);}}catch(e){}`;

export const SPLASH_CSS = `
.ep-splash{display:none}
html.ep-splash-on,html.ep-splash-on body{background:#060915}
html.ep-splash-on .ep-splash{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(120% 80% at 50% 40%,#1a1446 0%,#0b1124 50%,#060915 100%);transition:opacity .5s ease,transform .5s ease}
html.ep-splash-out .ep-splash{opacity:0;transform:scale(1.06);pointer-events:none}
.ep-splash-glow{position:absolute;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgb(124 58 237/.45),rgb(56 189 248/.12) 55%,transparent 70%);filter:blur(20px);animation:ep-glow 2.4s ease-in-out infinite alternate}
.ep-splash-mark{position:relative;width:132px;height:132px;display:grid;place-items:center}
.ep-splash-ring,.ep-splash-orbit{position:absolute;inset:0;width:100%;height:100%}
.ep-splash-arc{stroke-dasharray:352;stroke-dashoffset:352;transform-origin:60px 60px;transform:rotate(-90deg);animation:ep-arc 1.2s cubic-bezier(.65,0,.35,1) .15s forwards}
.ep-splash-orbit{opacity:0;animation:ep-fade-in .4s ease 1.3s forwards,ep-spin 1.1s linear 1.3s infinite}
.ep-splash-logo{width:78px;height:78px;filter:drop-shadow(0 18px 30px rgb(91 79 240/.6));animation:ep-breathe 2.4s ease-in-out .2s infinite alternate}
.ep-splash-word{margin-top:26px;font-family:var(--font-sora),Inter,system-ui,sans-serif;font-size:28px;font-weight:800;letter-spacing:-.02em;color:#fff;opacity:0;animation:ep-rise .7s cubic-bezier(.22,1,.36,1) .55s forwards}
.ep-splash-word span{background:linear-gradient(90deg,#a78bfa,#818cf8 45%,#38bdf8);-webkit-background-clip:text;background-clip:text;color:transparent}
.ep-splash-tag{margin-top:8px;font-family:var(--font-inter),Inter,system-ui,sans-serif;font-size:14px;font-weight:500;color:#94a3b8;opacity:0;animation:ep-rise .7s cubic-bezier(.22,1,.36,1) .85s forwards}
.ep-splash-bar{position:absolute;bottom:calc(64px + env(safe-area-inset-bottom));width:120px;height:4px;border-radius:99px;background:rgb(255 255 255/.08);overflow:hidden;opacity:0;animation:ep-fade-in .4s ease 1s forwards}
.ep-splash-bar i{display:block;height:100%;width:100%;border-radius:inherit;background:linear-gradient(90deg,#7c3aed,#6366f1,#38bdf8);transform-origin:left;transform:scaleX(0);animation:ep-fill ${(SPLASH_MS - 1000) / 1000}s cubic-bezier(.4,0,.2,1) 1s forwards}
@keyframes ep-arc{to{stroke-dashoffset:0}}
@keyframes ep-spin{to{transform:rotate(360deg)}}
@keyframes ep-fade-in{to{opacity:1}}
@keyframes ep-fill{to{transform:scaleX(1)}}
@keyframes ep-breathe{from{transform:scale(1)}to{transform:scale(1.05)}}
@keyframes ep-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes ep-glow{from{opacity:.7;transform:scale(.92)}to{opacity:1;transform:scale(1.06)}}
@media (prefers-reduced-motion:reduce){.ep-splash *{animation:none!important}.ep-splash-arc{stroke-dashoffset:0}.ep-splash-word,.ep-splash-tag{opacity:1}}
`;
