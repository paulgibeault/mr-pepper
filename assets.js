/* assets.js — the painted art. Seven small files, loaded once.
 *
 * The game never waits on them: every image has a drawn fallback (flat
 * copper, vector ingredients, a plain wall), so a slow or failed load costs
 * looks, not play. `onReady` fires once when everything that is going to
 * arrive has arrived, and the renderer repaints.
 */

const FILES = {
  kitchen: 'assets/kitchen.webp',
  copper: 'assets/copper.webp',
  ing0: 'assets/ing-tomato.webp',
  ing1: 'assets/ing-potato.webp',
  ing2: 'assets/ing-broccoli.webp',
  ing3: 'assets/ing-eggplant.webp',
  ing4: 'assets/ing-clam.webp',
};

/* The copper, in grey: the texture inside the pot must not bring a hue of its
 * own. Done by hand because canvas `filter` is not something Safari has. */
function grey(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
    const v = Math.max(0, Math.min(255, (l - 128) * 1.25 + 128));
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  x.putImageData(d, 0, 0);
  return c;
}

export function loadAssets(onReady) {
  const art = {};
  const jobs = Object.entries(FILES).map(([key, src]) => new Promise((done) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { art[key] = img; done(); };
    img.onerror = () => done();
    img.src = src;
  }));
  Promise.all(jobs).then(() => {
    if (art.copper) art.copperGrey = grey(art.copper);
    onReady(art);
  });
  return art;
}
