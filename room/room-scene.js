  // ===============================================================================================
  // SCENE CONFIG
  // ===============================================================================================

  // Room pixels: the scene is 568x368, drawn K times larger on the canvas.
  const ROOM_W = 568,
    ROOM_H = 368,
    K = 3; // K = internal resolution multiplier

  // The globe: centre and radius in room pixels, how far up the disc the hero stands (degrees from its middle),
  // walking speed (degrees a second), pixels drawn per room pixel, and where he starts ([lat, lon]).
  const GLOBE = { cx: 284, cy: 228, r: 138, stand: 62, speed: 45, res: 2, start: [34.5, 9.6] };

  // Image files to preload: the earth map and the hero's animations.
  const SPRITES = {
    earth: "assets/globe-earth.jpg",
    walk: "assets/hero-sheet-walk.png",
    idle: "assets/hero-sheet-idle.png",
    interact: "assets/hero-sheet-idle.png",
    idle2: "assets/hero-sheet-idle2.png",
    jump: "assets/hero-sheet-jump.png",
  };

  // hero-sheet-*.png: frames of 300x300 in rows of 5, drawn facing right (mirrored for left), feet on y 292. Walk and
  // jump have 5 frames each, idle 27 (a blink in the middle), idle2 27 (chin rub, head scratch). Drawn at a third of their size, so with K = 3 every sprite
  // pixel lands on one canvas pixel.
  const CHAR = { frame: 300, cols: 5, frames: 5, idleFrames: 27, footY: 292, scale: 1 / 3, facesLeft: false };

  // ===============================================================================================
  // ZONES
  // ===============================================================================================

  // Interactive zones (USA, Canada, Tunisia...): one file each in room/zones/, loaded by index.html right after
  // this file. Each file calls zone({...}) with its country, spot, label, dialogue and panel (see the README).
  const ZONES = [];
  // Registers a zone, and loads its own stylesheet when it names one.
  function zone(z) {
    ZONES.push(z);
    if (z.css) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: z.css }));
  }

  // The registered zone with this id, if any.
  const zoneById = (id) => ZONES.find((z) => z.id === id);
