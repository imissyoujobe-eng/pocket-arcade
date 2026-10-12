// Offline cache for Pixel Legends. Bump VERSION whenever you add or change a game.
const VERSION = "legends-v11";
const FILES = [
 "./",
 "./games.js",
 "./games/agent-zero.html",
 "./games/axe-and-sorcery.html",
 "./games/barbarian-blade.html",
 "./games/barnyard-brigade.html",
 "./games/cloud-castle.html",
 "./games/commando-sights.html",
 "./games/critter-quest.html",
 "./games/cube-pop.html",
 "./games/deep-core.html",
 "./games/diamond-dash.html",
 "./games/door-runner.html",
 "./games/fairway-nine.html",
 "./games/fist-city.html",
 "./games/fling-frenzy.html",
 "./games/girder-gauntlet.html",
 "./games/hollow-crown.html",
 "./games/hyper-rail.html",
 "./games/juice-slash.html",
 "./games/jungle-fire.html",
 "./games/kart-clash.html",
 "./games/kickflip-city.html",
 "./games/knight-fright.html",
 "./games/knockout-kid.html",
 "./games/pipe-hopper.html",
 "./games/powder-peak.html",
 "./games/ramp-rally.html",
 "./games/saddle-up.html",
 "./games/shadow-strike.html",
 "./games/sky-tail.html",
 "./games/street-brawl.html",
 "./games/three-day-tide.html",
 "./games/twin-realms.html",
 "./games/vine-kings.html",
 "./games/wing-squadron.html",
 "./icons/icon-192.png",
 "./icons/icon-512.png",
 "./icons/maskable-512.png",
 "./index.html",
 "./lib/art.js",
 "./lib/brawl.js",
 "./lib/kit.js",
 "./lib/planck.min.js",
 "./lib/plat.js",
 "./lib/racer.js",
 "./lib/td.js",
 "./lib/three.min.js",
 "./manifest.webmanifest",
 "./privacy.html"
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && (new URL(e.request.url).origin === location.origin || e.request.url.includes('fonts.g'))) {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match('./index.html'))));
});
