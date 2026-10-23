// Offline cache for Pocket Arcade. Bump VERSION whenever you add or change a game.
const VERSION = "arcade-v15";
const FILES = [
 "./",
 "./games.js",
 "./games/aero-assault.html",
 "./games/apex-grand-prix.html",
 "./games/block-builder.html",
 "./games/boot-camp-blitz.html",
 "./games/bounce-breaker.html",
 "./games/box-out.html",
 "./games/bug-bloom.html",
 "./games/city-smash.html",
 "./games/coast-rush.html",
 "./games/copter-pack.html",
 "./games/deep-dive.html",
 "./games/dot-chomper.html",
 "./games/downtown-dash.html",
 "./games/eat-my-dust.html",
 "./games/echo-fin.html",
 "./games/fortress-flight.html",
 "./games/frost-cup.html",
 "./games/fuel-run.html",
 "./games/gloom-dungeon.html",
 "./games/jungle-dash.html",
 "./games/junk-planet.html",
 "./games/kablam.html",
 "./games/kings-row.html",
 "./games/lake-showdown.html",
 "./games/lost-mine.html",
 "./games/lunar-rover.html",
 "./games/lunchbox-laser.html",
 "./games/marble-run.html",
 "./games/marsh-shot.html",
 "./games/mole-patrol.html",
 "./games/oval-rush.html",
 "./games/paddle-party.html",
 "./games/peak-hopper.html",
 "./games/ping.html",
 "./games/pot-drop.html",
 "./games/pub-darts.html",
 "./games/quarter-mile.html",
 "./games/rink-rumble.html",
 "./games/road-hopper.html",
 "./games/rodeo-roundup.html",
 "./games/rotor-strike.html",
 "./games/saucer-sweep.html",
 "./games/sky-shield.html",
 "./games/snow-siege.html",
 "./games/space-cadet.html",
 "./games/spore-patrol.html",
 "./games/spy-guy.html",
 "./games/star-trench.html",
 "./games/sundown-showdown.html",
 "./games/tread-storm.html",
 "./games/volt-maze.html",
 "./games/wing-knights.html",
 "./icons/icon-192.png",
 "./icons/icon-512.png",
 "./icons/maskable-512.png",
 "./index.html",
 "./lib/art.js",
 "./lib/joy.js",
 "./lib/kit.js",
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
