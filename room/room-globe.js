  // ===============================================================================================
  // GLOBE
  // ===============================================================================================

  // The room is a globe: the hero stands on top of it and the world turns under his feet. Zones are countries.
  // A point on the globe is [lat, lon] in degrees; the view is always north-up, with the hero's spot GLOBE.stand
  // degrees up from the middle of the disc, so he stands near the top edge.

  const RAD = Math.PI / 180;
  // Unit vector of a [lat, lon] point: x east (at lon 0), y north, z out of the screen (at lat 0, lon 0).
  const vec = ([la, lo]) => [Math.cos(la * RAD) * Math.sin(lo * RAD), Math.sin(la * RAD), Math.cos(la * RAD) * Math.cos(lo * RAD)];
  // [lat, lon] of a unit vector.
  const latLon = ([x, y, z]) => [Math.asin(Math.max(-1, Math.min(1, y))) / RAD, Math.atan2(x, z) / RAD];
  // Angle in degrees between two [lat, lon] points.
  const arc = (a, b) => {
    const p = vec(a),
      q = vec(b);
    return Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]))) / RAD;
  };

  // The view for the hero standing at [lat, lon]: the disc's middle sits GLOBE.stand degrees south of him.
  const viewFor = ([la, lo]) => {
    const c = (la - GLOBE.stand) * RAD,
      l = lo * RAD;
    return { cc: Math.cos(c), sc: Math.sin(c), cl: Math.cos(l), sl: Math.sin(l) };
  };

  // The globe's live size and middle in the room: GLOBE.r and GLOBE.cy scaled by the zoom, with the hero's spot
  // kept where it is, so zooming grows or shrinks the world under him while he stays the same size.
  const SCALE = { r: GLOBE.r, cx: GLOBE.cx, cy: GLOBE.cy, zoom: 1, want: 1 };
  const ZOOM_MIN = 0.6,
    ZOOM_MAX = 3.5;

  // Asks for a zoom (1 = the globe as GLOBE sets it); it eases there in stepZoom().
  const zoomTo = (z) => (SCALE.want = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)));

  // Eases the zoom towards the one asked for, keeping the hero's spot (top of the globe) in place.
  function stepZoom(dt) {
    if (Math.abs(SCALE.want - SCALE.zoom) < 0.001) SCALE.zoom = SCALE.want;
    else SCALE.zoom += (SCALE.want - SCALE.zoom) * Math.min(1, dt * 14);
    const top = GLOBE.cy - Math.sin(GLOBE.stand * RAD) * GLOBE.r;
    SCALE.r = GLOBE.r * SCALE.zoom;
    SCALE.cy = top + Math.sin(GLOBE.stand * RAD) * SCALE.r;
  }

  // Where a [lat, lon] point lands in the room with view v: [x, y, depth]; depth > 0 is the visible side.
  function project(p, v) {
    const [x, y, z] = vec(p),
      xp = x * v.cl - z * v.sl,
      zp = x * v.sl + z * v.cl;
    return [SCALE.cx + xp * SCALE.r, SCALE.cy - (y * v.cc - zp * v.sc) * SCALE.r, y * v.sc + zp * v.cc];
  }

  // The [lat, lon] under room point (px, py) with view v, or null off the globe.
  function unproject([px, py], v) {
    const X = (px - SCALE.cx) / SCALE.r,
      Y = (SCALE.cy - py) / SCALE.r,
      q = X * X + Y * Y;

    if (q > 1) return null;
    const Z = Math.sqrt(1 - q),
      y = Y * v.cc + Z * v.sc,
      zp = -Y * v.sc + Z * v.cc;
    return latLon([X * v.cl + zp * v.sl, y, -X * v.sl + zp * v.cl]);
  }

  // Country outlines (assets/countries.json, simplified from Natural Earth): name -> rings of [lon, lat].
  let COUNTRIES = {};
  const globeLoad = fetch(GLOBE.countries || "assets/countries.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((j) => (COUNTRIES = j))
    .catch((e) => console.warn("assets/countries.json not loaded: countries won't glow", e));

  // Point-in-polygon test (ray casting) on [x, y] pairs, used for the country outlines.
  const inPoly = ([x, y], poly) => {
    let c = false;
    // Flips inside/outside each time an edge crosses the ray from the point.
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i],
        [xj, yj] = poly[j];

      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }

    return c;
  };

  // True when [lat, lon] is on the zone: inside its country, or within its tap radius of the zone's spot (small
  // countries like Malta are only a pixel or two wide).
  const onZone = (p, z) =>
    arc(p, z.at) <= (z.hit || 3) || (COUNTRIES[z.country] || []).some((ring) => inPoly([p[1], p[0]], ring));

  // Zones with their own hero animation: preload each sheet with the other sprites.
  ZONES.forEach((z) => z.anim && z.anim.sheet && (SPRITES["anim-" + z.id] = z.anim.sheet));

  // ===============================================================================================
  // GLOBE PICTURE
  // ===============================================================================================

  // The editor's picture of the whole globe: drawn pixel by pixel into its own canvas, GLOBE.res pixels per room
  // pixel, and only again when the view changes. Each disc pixel keeps its direction and shading, worked out once.
  const GD = Math.round(GLOBE.r * 2 * GLOBE.res),
    gCanvas = document.createElement("canvas");

  gCanvas.width = gCanvas.height = GD;
  const gCtx = gCanvas.getContext("2d"),
    gImg = gCtx.createImageData(GD, GD),
    gOut = new Uint32Array(gImg.data.buffer);

  // Disc pixels: index into the picture, view direction (X, Y, Z) and brightness.
  const gIdx = [],
    gX = [],
    gY = [],
    gZ = [],
    gS = [];

  for (let j = 0; j < GD; j++)
    for (let i = 0; i < GD; i++) {
      const X = ((i + 0.5) / GD) * 2 - 1,
        Y = 1 - ((j + 0.5) / GD) * 2,
        q = X * X + Y * Y;

      if (q >= 1) continue;
      const Z = Math.sqrt(1 - q);
      gIdx.push(j * GD + i);
      gX.push(X);
      gY.push(Y);
      gZ.push(Z);
      // light from the upper left, softened so the night side stays readable
      gS.push(0.62 + 0.38 * Math.max(0, -0.35 * X + 0.45 * Y + 0.82 * Z));
    }

  // The earth picture's pixels (assets/globe-earth.png, an equirectangular map drawn by tools/make-earth.py), read once it has loaded.
  let tex = null,
    texW = 0,
    texH = 0,
    gView = null;

  // Reads the earth picture into a pixel array.
  function readTexture() {
    const im = imgs.earth;
    if (!im) return;
    const c = document.createElement("canvas");
    c.width = texW = im.naturalWidth;
    c.height = texH = im.naturalHeight;
    const g = c.getContext("2d");
    g.drawImage(im, 0, 0);
    tex = new Uint32Array(g.getImageData(0, 0, texW, texH).data.buffer);
  }

  // Paints the globe for view v into gCanvas (skipped when the view hasn't changed).
  function renderGlobe(v) {
    if (!tex && imgs.earth) readTexture();
    if (!tex) return;
    if (gView && gView.cc === v.cc && gView.sc === v.sc && gView.cl === v.cl && gView.sl === v.sl) return;
    gView = v;
    const tw = texW / (2 * Math.PI),
      th = texH / Math.PI;

    // For each disc pixel: turn its direction into [lat, lon], read the map there and shade it.
    for (let k = 0; k < gIdx.length; k++) {
      const X = gX[k],
        Y = gY[k],
        Z = gZ[k],
        y = Y * v.cc + Z * v.sc,
        zp = -Y * v.sc + Z * v.cc,
        x = X * v.cl + zp * v.sl,
        z = -X * v.sl + zp * v.cl;

      const u = ((Math.atan2(x, z) + Math.PI) * tw) | 0,
        w = ((Math.PI / 2 - Math.asin(y > 1 ? 1 : y < -1 ? -1 : y)) * th) | 0,
        c = tex[(w < texH ? w : texH - 1) * texW + (u < texW ? u : texW - 1)],
        s = gS[k];

      gOut[gIdx[k]] = 0xff000000 | (((c >>> 16) & 255) * s) << 16 | (((c >>> 8) & 255) * s) << 8 | ((c & 255) * s);
    }

    gCtx.putImageData(gImg, 0, 0);
  }

  // The room's own picture of the globe: drawn straight at room size (GLOBE.res pixels per room pixel, 1 when
  // zoomed in far), only over the part of the disc that is on screen, so any zoom stays sharp and quick.
  const sCanvas = document.createElement("canvas"),
    sCtx = sCanvas.getContext("2d");

  let sImg = null,
    sOut = null,
    sKey = "";

  // Paints the globe for view v at the current zoom into sCanvas (skipped when nothing changed).
  function renderScreen(v) {
    if (!tex && imgs.earth) readTexture();
    if (!tex) return;
    const { cx, cy, r } = SCALE,
      res = r > GLOBE.r * 1.3 ? 1 : GLOBE.res,
      key = [v.cc, v.sc, v.cl, v.sl, r, res].join();

    if (key === sKey) return;
    sKey = key;
    const W = ROOM_W * res,
      H = ROOM_H * res;

    if (sCanvas.width !== W || sCanvas.height !== H || !sImg) {
      sCanvas.width = W;
      sCanvas.height = H;
      sImg = sCtx.createImageData(W, H);
      sOut = new Uint32Array(sImg.data.buffer);
    } else sOut.fill(0);

    const tw = texW / (2 * Math.PI),
      th = texH / Math.PI,
      R = r * res,
      CX = cx * res,
      CY = cy * res;

    // Row by row over the disc's on-screen part: each pixel's direction to [lat, lon], the map there, shaded.
    for (let j = Math.max(0, Math.floor(CY - R)); j < Math.min(H, Math.ceil(CY + R)); j++) {
      const Y = (CY - j - 0.5) / R,
        half = Math.sqrt(Math.max(0, 1 - Y * Y)) * R;

      for (let i = Math.max(0, Math.floor(CX - half)); i < Math.min(W, Math.ceil(CX + half)); i++) {
        const X = (i + 0.5 - CX) / R,
          q = X * X + Y * Y;

        if (q >= 1) continue;
        const Z = Math.sqrt(1 - q),
          y = Y * v.cc + Z * v.sc,
          zp = -Y * v.sc + Z * v.cc,
          x = X * v.cl + zp * v.sl,
          z = -X * v.sl + zp * v.cl,
          u = ((Math.atan2(x, z) + Math.PI) * tw) | 0,
          w = ((Math.PI / 2 - Math.asin(y > 1 ? 1 : y < -1 ? -1 : y)) * th) | 0,
          c = tex[(w < texH ? w : texH - 1) * texW + (u < texW ? u : texW - 1)],
          sh = 0.62 + 0.38 * Math.max(0, -0.35 * X + 0.45 * Y + 0.82 * Z);

        sOut[j * W + i] =
          0xff000000 | ((((c >>> 16) & 255) * sh) << 16) | ((((c >>> 8) & 255) * sh) << 8) | ((c & 255) * sh);
      }
    }

    sCtx.putImageData(sImg, 0, 0);
  }

  // Stars behind the globe, scattered once (the same sky on every visit).
  const STARS = (() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 140 }, () => ({ x: rnd() * ROOM_W, y: rnd() * ROOM_H, s: rnd(), p: rnd() * 7 }));
  })();

  // Draws the sky, the glow around the globe and the globe for view v.
  function drawGlobe(v, t) {
    ctx.fillStyle = "#04060d";
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    // A few stars twinkle; the rest stay still.
    for (const s of STARS) {
      ctx.globalAlpha = s.s > 0.85 ? 0.55 + 0.45 * Math.sin(t * 2 + s.p) : 0.25 + s.s * 0.5;
      ctx.fillStyle = s.s > 0.93 ? "#fff6d8" : "#cfd8ff";
      const w = s.s > 0.93 ? 1.5 : 1;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), w, w);
    }

    ctx.globalAlpha = 1;
    const { cx, cy, r } = SCALE;
    // Atmosphere: a soft blue halo just outside the disc.
    const halo = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.12);
    halo.addColorStop(0, "rgba(120,190,255,.55)");
    halo.addColorStop(1, "rgba(120,190,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.12, 0, 7);
    ctx.fill();
    renderScreen(v);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sCanvas, 0, 0, ROOM_W, ROOM_H);
    ctx.imageSmoothingEnabled = false;
    // A thin bright rim, like the edge of the atmosphere.
    ctx.strokeStyle = "rgba(170,215,255,.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 0.5, 0, 7);
    ctx.stroke();
  }

  // ===============================================================================================
  // STATE
  // ===============================================================================================

  // Hero state: where he stands on the globe, his walk (from, to, progress), facing and target zone. He is always
  // drawn at the same room point, on top of the globe.
  const player = {
    at: GLOBE.start.slice(),
    view: GLOBE.start.slice(), // how the globe is turned: [pitch, lon], where pitch runs on past the poles (see below)
    pos: [GLOBE.cx, GLOBE.cy - Math.sin(GLOBE.stand * RAD) * GLOBE.r],
    walk: null,
    left: false,
    moving: false,
    t: 0,
    pending: null,
  };

  // Marker for the clicked spot ([lat, lon]), the id of the hovered zone, and the panel-less zone he is resting at
  // (he keeps playing its animation until he walks off).
  let marker = null,
    hover = null,
    restZone = null;

  // The globe turns all the way round, over the poles too. player.view is [pitch, lon]: pitch is his latitude while
  // the globe is the right way up, and keeps counting past 90 when it rolls over a pole (90-270: upside down, where
  // he really stands at latitude 180 - pitch, on the other side of the world: lon + 180).
  const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  const upsideDown = () => Math.cos(player.view[0] * RAD) < 0;

  // His [lat, lon] for a [pitch, lon] view.
  function atFromView([p, l]) {
    p = wrap(p);
    if (p > 90) return [180 - p, wrap(l + 180)];
    if (p < -90) return [-180 - p, wrap(l + 180)];
    return [p, wrap(l)];
  }

  // The [pitch, lon] view for him at [lat, lon], keeping the globe the way up it is now.
  const viewFromAt = ([la, lo]) => (upsideDown() ? [180 - la, wrap(lo - 180)] : [la, lo]);

  // The view of the globe as it is turned now.
  const heroView = () => viewFor(player.view);

  // Walks the hero to [lat, lon] along the shortest way round the globe, optionally heading for a zone.
  function goTo(p, obj) {
    const target = obj ? obj.at : p;
    if (restZone) player.rising = true; // walking off a rest: he plays the zone's turn-back before he moves
    restZone = null;
    player.pending = obj || null;
    marker = obj ? null : { p: target, t: 0 };
    const a = arc(player.at, target);
    if (a < 0.2) {
      player.walk = null;
      arrive();
      return;
    }

    player.walk = { from: vec(player.at), to: vec(target), a: a * RAD, d: 0.5 + a / GLOBE.speed, k: 0 };
  }

  // Moves the hero by dt seconds: along a drag of the globe (see spin below), or along a walk, a slerp between the
  // two points, eased at both ends.
  function stepWalk(dt) {
    stepZoom(dt);
    if (stepSpin(dt)) return;
    const w = player.walk;
    if (!w || player.rising) {
      player.moving = false;
      return;
    }

    player.moving = true;
    player.t += dt;
    w.k = Math.min(1, w.k + dt / w.d);
    const e = w.k < 0.5 ? 2 * w.k * w.k : 1 - 2 * (1 - w.k) * (1 - w.k),
      s = Math.sin(w.a),
      f = Math.sin((1 - e) * w.a) / s,
      g = Math.sin(e * w.a) / s;

    player.at = latLon([0, 1, 2].map((i) => f * w.from[i] + g * w.to[i]));
    player.view = viewFromAt(player.at);
    // Faces the way the destination lies across the screen.
    const x = project(latLon(w.to), heroView())[0] - SCALE.cx;
    if (Math.abs(x) > 2) player.left = x < 0;
    if (w.k >= 1) {
      player.walk = null;
      player.moving = false;
      arrive();
    }
  }

  // Called when the walk ends: starts the zone's talk, or just idles.
  function arrive() {
    marker = null;
    if (player.pending) {
      const o = player.pending;
      player.pending = null;
      spin.visited = o.id; // a small drag inside the zone afterwards doesn't open it again
      setTimeout(() => talk(o.id), 150);
    }
  }

  // ===============================================================================================
  // DRAG
  // ===============================================================================================

  // Dragging the globe turns it under the hero, any way and all the way round, and he walks along with it: the ground
  // under the finger follows the finger, so he walks the other way. Let go and the globe coasts to a stop; if he stops on a zone's country, he
  // visits it. spin.dx/dy: drag not applied yet (room pixels), vx/vy: speed in room pixels per second.
  const spin = { on: false, dx: 0, dy: 0, vx: 0, vy: 0, moved: false, visited: null };

  // How fast he walks over the ground for each room pixel of drag (the ground in the middle of the disc), and how
  // fast the coasting dies down after a release.
  const spinDeg = () => 1 / (SCALE.r * RAD),
    SPIN_FRICTION = 4;

  // Starts a drag: ends any talk and any walk, and lets him get up first if he was resting at a zone.
  function spinStart() {
    if (typeof endTalk === "function") endTalk(false);
    if (restZone) player.rising = true;
    restZone = null;
    player.walk = player.pending = marker = null;
    Object.assign(spin, { on: true, dx: 0, dy: 0, vx: 0, vy: 0 });
  }

  // Adds a pointer move (room pixels) to the drag.
  function spinBy(dx, dy) {
    spin.dx += dx;
    spin.dy += dy;
  }

  // Ends a drag; the globe keeps its speed and coasts.
  function spinEnd() {
    spin.on = false;
  }

  // Applies the drag (or the coasting) for dt seconds. Returns true while the globe is moving this way.
  function stepSpin(dt) {
    if (spin.on) {
      // Smoothed speed of the finger, so a release keeps the feel of the last moves.
      const k = Math.min(1, dt * 18);
      spin.vx += (spin.dx / Math.max(dt, 1e-3) - spin.vx) * k;
      spin.vy += (spin.dy / Math.max(dt, 1e-3) - spin.vy) * k;
    } else {
      const f = Math.exp(-SPIN_FRICTION * dt);
      spin.vx *= f;
      spin.vy *= f;
      if (Math.hypot(spin.vx, spin.vy) < 12) spin.vx = spin.vy = 0;
      spin.dx = spin.vx * dt;
      spin.dy = spin.vy * dt;
    }

    const dx = spin.dx,
      dy = spin.dy,
      speed = Math.hypot(spin.vx, spin.vy);

    spin.dx = spin.dy = 0;
    // Getting up from a rest first: the ground waits for him.
    if (player.rising) return spin.on;
    if (dx || dy) {
      // Up and down rolls the globe over, all the way round. Sideways spins it on its axis, at the speed that keeps
      // the middle of the disc under the finger (eased near the poles, flipped while it is upside down).
      const c = Math.cos((player.view[0] - GLOBE.stand) * RAD),
        k = Math.sign(c || 1) * Math.max(0.35, Math.abs(c));

      player.view = [wrap(player.view[0] + dy * spinDeg()), wrap(player.view[1] - (dx * spinDeg()) / k)];
      player.at = atFromView(player.view);
      if (Math.abs(dx) > 0.15) player.left = dx > 0;
      spin.moved = true;
    }

    const moving = speed > 15;
    player.moving = moving;
    // Steps keep pace with the ground: slow drags walk slowly, fast ones quickly.
    if (moving) player.t += dt * Math.max(0.5, Math.min(2.2, speed / 110));
    if (!spin.on && !moving && spin.moved) {
      spin.moved = false;
      spinStop();
    }

    return spin.on || moving;
  }

  // The globe came to rest: if he stands on a zone's country, he visits it (once until he walks off it).
  function spinStop() {
    const z = ZONES.find((z) => z.at && onZone(player.at, z));
    if (!z) {
      spin.visited = null;
      return;
    }

    if (spin.visited === z.id) return;
    // A short pause first, so passing over a country on the way somewhere else doesn't open it.
    setTimeout(() => {
      if (spin.on || player.moving || !onZone(player.at, z) || spin.visited === z.id) return;
      spin.visited = z.id;
      talk(z.id);
    }, 450);
  }
