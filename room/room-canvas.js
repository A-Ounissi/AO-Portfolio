  // ===============================================================================================
  // CANVAS
  // ===============================================================================================

  // Room canvas, its drawing context and the stage that holds it.
  const canvas = document.getElementById("c"),
    ctx = canvas.getContext("2d"),
    stage = document.getElementById("stage");

  canvas.width = ROOM_W * K;
  canvas.height = ROOM_H * K;
  // Fits the canvas to the stage at an integer-friendly scale and redraws.
  function resize() {
    const r = stage.getBoundingClientRect();
    const s = Math.max(1, Math.min(r.width / ROOM_W, r.height / ROOM_H));
    canvas.style.width = Math.floor(ROOM_W * s) + "px";
    canvas.style.height = Math.floor(ROOM_H * s) + "px";
  }

  new ResizeObserver(resize).observe(stage);

  // a long-press on the room must not open a menu or select it
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("selectstart", (e) => e.preventDefault());
  const imgs = {};
  let loaded = 0;
  // Items to load (every sprite, content.json and the country outlines) and the loading bar.
  const total = Object.keys(SPRITES).length + 2,
    bar = document.getElementById("load-bar");

  // Advances the loading bar by one loaded item.
  const tick = () => {
    loaded++;
    if (bar) bar.style.width = (100 * loaded) / total + "%";
  };

  // content.json next to index.html wins; if it can't be read (opened as a plain file, or missing)
  // the placeholder content built into index.html stays.
  const contentLoad = fetch("content.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((j) => {
      if (j && j.schemaVersion === 1) {
        CONTENT = j;
        applyContent();
      } else console.warn("content.json: unsupported schemaVersion");
    })
    .catch((e) => console.warn("content.json not loaded, using built-in placeholder content", e))
    .finally(tick);

  // Frame counts saved by the editor's Animation page; without the file the counts in the code stay.
  const animsLoad = fetch("assets/anims.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => j && applyAnims(j))
    .catch((e) => console.warn("assets/anims.json not loaded", e));

  // Every load to wait for before the room starts: content.json, the frame counts and each sprite.
  const loads = [contentLoad, animsLoad, globeLoad.finally(tick)].concat(
    Object.entries(SPRITES).map(
      ([k, src]) =>
        new Promise((res) => {
          const im = new Image();
          // Keeps the loaded image and advances the loading bar.
          im.onload = () => {
            imgs[k] = im;
            tick();
            res();
          };

          // Skips a missing image but still counts it so loading can finish.
          im.onerror = () => {
            tick();
            res();
          };

          im.src = src;
        }),
    ),
  );

  // Converts a pointer event to room pixel coordinates.
  function roomPoint(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * ROOM_W, ((e.clientY - r.top) / r.height) * ROOM_H];
  }

  // Room rectangles of the zone labels drawn last frame, so a click on a label picks its zone.
  let labelBoxes = [];
  // The zone under a room point, if any: its label, then its country on the globe.
  function objectAt(p) {
    const b = labelBoxes.find((b) => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h);
    if (b) return zoneById(b.id);
    const ll = unproject(p, heroView());
    return ll ? ZONES.find((z) => z.at && onZone(ll, z)) : null;
  }

  // One finger (or the mouse) drags the globe: it turns under the hero and he walks along (see DRAG in
  // room-globe.js). A drag only starts once the pointer has moved a little; a plain tap walks him to the country
  // or spot tapped instead. Two
  // fingers pinch to zoom, and the mouse wheel zooms too; the hero keeps his size.
  const touches = new Map(); // pointer id -> last room point
  let press = null, // { id, p, started } for the pointer dragging the globe
    pinch = null; // { d, zoom } while two fingers are down

  // Distance between the two fingers on the globe.
  const pinchSpan = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (!overlay.hidden) return;
    canvas.setPointerCapture(e.pointerId);
    touches.set(e.pointerId, roomPoint(e));
    if (touches.size === 2) {
      // A second finger: the drag stops and the pinch starts.
      if (press && press.started) spinEnd();
      press = null;
      pinch = { d: Math.max(1, pinchSpan()), zoom: SCALE.want };
      return;
    }

    if (touches.size === 1) press = { id: e.pointerId, p: roomPoint(e), started: false };
  });

  // Moves the drag or the pinch, or highlights the zone under the pointer when nothing is pressed.
  canvas.addEventListener("pointermove", (e) => {
    const p = roomPoint(e);
    if (touches.has(e.pointerId)) touches.set(e.pointerId, p);
    if (pinch && touches.size === 2) {
      zoomTo(pinch.zoom * (pinchSpan() / pinch.d));
      return;
    }

    if (press && press.id === e.pointerId) {
      if (!press.started && Math.hypot(p[0] - press.p[0], p[1] - press.p[1]) > 2) {
        press.started = true;
        spinStart();
      }

      // Until the drag starts, the press point stays put so slow moves still add up.
      if (press.started) {
        spinBy(p[0] - press.p[0], p[1] - press.p[1]);
        press.p = p;
        canvas.style.cursor = "grabbing";
      }

      return;
    }

    const o = objectAt(p);
    hover = o ? o.id : null;
    canvas.style.cursor = o ? "var(--hand)" : "grab";
  });

  // A finger or the mouse lets go: the globe coasts to a stop; lifting one finger of a pinch ends the pinch.
  const release = (e) => {
    touches.delete(e.pointerId);
    if (pinch) {
      if (touches.size < 2) pinch = null;
      return;
    }

    if (!press || press.id !== e.pointerId) return;
    const tap = !press.started;
    if (press.started) spinEnd();
    press = null;
    canvas.style.cursor = "grab";
    // A tap (no drag): he walks to the spot or zone tapped, and the zone opens when he gets there.
    if (tap && overlay.hidden) {
      const p = roomPoint(e),
        o = objectAt(p),
        ll = unproject(p, heroView());

      if (!o && !ll) return; // a tap in space
      endTalk(false);
      goTo(ll, o);
    }
  };

  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  // The wheel (or a trackpad pinch, which browsers send as a wheel with Ctrl) zooms in and out.
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!overlay.hidden) return;
      e.preventDefault();
      zoomTo(SCALE.want * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    },
    { passive: false },
  );

  // + and - zoom from the keyboard too.
  addEventListener("keydown", (e) => {
    if (!overlay.hidden || e.ctrlKey || e.metaKey) return;
    if (e.key === "+" || e.key === "=") zoomTo(SCALE.want * 1.25);
    else if (e.key === "-" || e.key === "_") zoomTo(SCALE.want / 1.25);
  });

  // Clears the hover highlight when the pointer leaves the room.
  canvas.addEventListener("pointerleave", () => {
    hover = null;
  });

  // Traces a country's outlines on the globe with view v (the parts on the far side are left out).
  function countryPath(name, v) {
    ctx.beginPath();
    for (const ring of COUNTRIES[name] || []) {
      let pen = false,
        broke = false,
        prev = null;
      for (const [lo, la] of ring) {
        const [x, y, d] = project([la, lo], v);
        // lift the pen on the far side, and where a ring jumps across the date line (Alaska, Russia, Fiji)
        if (d <= 0 || (prev !== null && Math.abs(lo - prev) > 180)) {
          pen = false;
          broke = true;
        }
        prev = lo;
        if (d <= 0) continue;

        pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        pen = true;
      }

      if (!broke) ctx.closePath(); // a ring cut in pieces stays open, so no chord is drawn across the globe
    }
  }

  // A zone's outline colour (color) and hover colour (hoverColor), set on the editor's Zones page, as "#rrggbb".
  const zoneColor = (o, on) => (on ? o.hoverColor || "#7ff3ff" : o.color || "#ffd36a");
  // A "#rrggbb" colour at the given opacity.
  const alpha = (hex, a) =>
    "rgba(" + [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0).join(",") + "," + a + ")";

  // Draws each zone's country tinted and outlined in its colour, in its hover colour (pulsing) when hovered, and a
  // pin on its spot.
  function drawZones(v, t) {
    for (const o of ZONES) {
      if (!o.at) continue;
      const on = hover === o.id,
        c = zoneColor(o, on);

      countryPath(o.country, v);
      ctx.fillStyle = alpha(c, on ? 0.3 + 0.1 * Math.sin(t * 5) : 0.16);
      ctx.fill("evenodd");
      ctx.strokeStyle = on ? c : alpha(c, 0.7);
      ctx.lineWidth = 1;
      ctx.stroke();

      // The pin: a small dot on the zone's spot, pulsing when hovered.
      const [x, y, d] = project(o.at, v);
      if (d <= 0.05 || arc(player.at, o.at) <= 4) continue;
      ctx.fillStyle = "#120e1a";
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
  }

  // idle variation sheets, played in this order between stretches of the base idle loop
  const IDLE_VARS = [{ key: "idle2", frames: 27 }];
  // the jump: only ever played when "j" is pressed
  const JUMP = { key: "jump", frames: 5 };

  // Takes the hero's frame counts from assets/anims.json, so frames added or deleted on the Animation page play
  // with no code change.
  function applyAnims(j) {
    const hero = (j.entities || []).find((e) => e.id === "hero"),
      n = (id) => {
        const a = hero && (hero.anims || []).find((a) => a.id === id);
        return a && a.frames > 0 ? a.frames : null;
      };

    if (n("walk")) CHAR.frames = n("walk");
    if (n("idle")) {
      CHAR.idleFrames = n("idle");
      INTERACT.loop = [...Array(CHAR.idleFrames).keys()];
    }

    IDLE_VARS.forEach((v) => n(v.key) && (v.frames = n(v.key)));
    if (n("jump")) JUMP.frames = n("jump");
  }

  // Idle variation timing, the queued jump and interact start and end times.
  let idleVar = null,
    varAt = 0,
    curVar = null,
    wantDrink = false,
    nextVar = 3,
    busyAt = null,
    freeAt = null,
    busyAnim = null;

  // The animation every zone plays unless it has its own: the hero keeps his idle loop while the banner or panel is up.
  const INTERACT = {
    key: "interact",
    fps: 5,
    intro: 0,
    loop: [...Array(CHAR.idleFrames).keys()],
    loopFps: 5,
    outro: [],
    outroFps: 5,
  };

  // ===============================================================================================
  // zoneAnim()
  // ===============================================================================================

  // The animation for the zone he is busy with: its own anim sheet when it has one that loaded, else INTERACT.
  // A zone anim gives sheet and frames; intro, loop, outro and their speeds are optional (see room/zones/README.md).
  function zoneAnim() {
    // The zone he rests at, else the one he is talking about, else the one whose panel is open.
    const panel = !overlay.hidden && document.querySelector(".dialog").dataset.panel,
      z = zoneById(restZone || (talkState && talkState.id) || panel),
      a = z && z.anim;

    if (!a || !imgs["anim-" + z.id]) return INTERACT;
    const fps = a.fps || 10,
      intro = a.intro || 0;

    // Fills in the defaults: loop every frame after the intro, no turn-back, all at the same speed.
    return {
      key: "anim-" + z.id,
      fps,
      intro,
      loop: a.loop || [...Array(a.frames).keys()].slice(intro),
      loopFps: a.loopFps || fps,
      outro: a.outro || [],
      outroFps: a.outroFps || fps,
    };
  }

  // "j" makes the hero jump once; it waits for any other animation to finish and is ignored mid-jump
  addEventListener("keydown", (e) => {
    if ((e.key === "j" || e.key === "J") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
      if (!curVar || curVar.key !== "jump") wantDrink = true;
    }
  });

  // ===============================================================================================
  // interactFrame()
  // ===============================================================================================

  // interacting: play the zone's intro once and loop it while the banner or panel is up (or while he rests at a
  // zone without a panel), then play its turn-back. Returns the frame number, or null when he is not interacting.
  function interactFrame() {
    const busy = !!talkState || !overlay.hidden || !!restZone;
    // Remembers when the banner or panel opened to start the reach-in, and which animation to play.
    if (busy && busyAt === null) {
      busyAt = clock;
      freeAt = null;
      busyAnim = zoneAnim();
    }

    // Remembers when it closed to start the turn-back.
    if (!busy && busyAt !== null) {
      busyAt = null;
      freeAt = clock;
    }

    const A = busyAnim;
    // While busy: play the reach-in once, then loop the working frames.
    if (busyAt !== null) {
      const k = Math.floor((clock - busyAt) * A.fps);
      return k < A.intro ? k : A.loop[Math.floor(((k - A.intro) * A.loopFps) / A.fps) % A.loop.length];
    }

    // After closing: play the turn-back frames once, then return to idle.
    if (freeAt !== null) {
      const k = Math.floor((clock - freeAt) * A.outroFps);
      if (k < A.outro.length) return A.outro[k];
      freeAt = null;
    }

    return null;
  }

  // ===============================================================================================
  // drawPlayer()
  // ===============================================================================================

  // Draws the hero: walk, idle, idle variation or interact frames, mirrored when facing left.
  function drawPlayer() {
    // Whether he is walking and where his feet are in the room.
    const walking = player.moving,
      [x, y] = player.pos;

    const act = walking || !imgs.interact ? (busyAt = freeAt = null) : interactFrame();
    if (player.rising && busyAt === null && freeAt === null) player.rising = false; // turn-back done: he can walk
    // idle: base loop, with a variation sheet played once now and then; the variations take turns.
    // Pressing "j" queues the jump, which starts as soon as nothing else is playing.
    // While he walks or works at a zone the timer restarts, so a variation never fires the moment he stops.
    if (walking || act !== null) {
      idleVar = curVar = null;
      nextVar = clock + 6 + Math.random() * 6;
    }
    else if (idleVar === null) {
      const loaded = IDLE_VARS.filter((v) => imgs[v.key]);
      // Picks the queued jump first, otherwise the next variation when it is due.
      if (wantDrink && imgs.jump) curVar = JUMP;
      else if (clock > nextVar && loaded.length) curVar = loaded[varAt++ % loaded.length];

      // Starts the chosen variation and clears the jump request.
      if (curVar) {
        idleVar = clock;
        if (curVar.key === "jump") wantDrink = false;
      }
    }

    // Ends a finished variation and schedules the next one 6 to 12 seconds later.
    if (idleVar !== null && clock - idleVar >= curVar.frames / 6) {
      idleVar = curVar = null;
      nextVar = clock + 6 + Math.random() * 6;
    }

    // Chooses the sprite sheet for the current state: walk, interact, variation or idle.
    const im = walking
      ? imgs.walk
      : act !== null
        ? imgs[busyAnim.key]
        : idleVar !== null
          ? imgs[curVar.key]
          : imgs.idle || imgs.walk;

    ctx.fillStyle = "rgba(10,6,16,.35)";
    ctx.beginPath();
    ctx.ellipse(x, y, 12, 4, 0, 0, 7);
    ctx.fill();
    if (!im) return;
    // Frame size and drawing scale of the hero sprite.
    const f = CHAR.frame,
      s = CHAR.scale;

    // Picks the frame number within the chosen sheet for the current state.
    const n = walking
      ? Math.floor(player.t * 10) % CHAR.frames
      : act !== null
        ? act
        : idleVar !== null
          ? (curVar.seq || [...Array(curVar.frames).keys()])[
              Math.min(curVar.frames - 1, Math.floor((clock - idleVar) * 6))
            ]
          : imgs.idle
            ? Math.floor(clock * 5) % CHAR.idleFrames
            : 0;

    // Source position of that frame in the sheet grid.
    const sx = (n % CHAR.cols) * f,
      sy = Math.floor(n / CHAR.cols) * f;

    const flip = CHAR.facesLeft ? !player.left : player.left;
    ctx.save();
    ctx.translate(x, y - CHAR.footY * s);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, sx, sy, f, f, (-f * s) / 2, 0, f * s, f * s);
    ctx.restore();
  }

  // a Pixelarticon in front of each room label (each zone names its own; same icons as the editor's home tiles).
  // Draws a Pixelarticon at 12 room pixels (one icon pixel = one room pixel), in the current fill colour.
  // The icons sit on an odd or even 2-unit grid; the offset lines their pixels up with the room's pixels.
  function labelIcon(name, x, y) {
    // The icon's SVG path and its first point, used to snap it to the room's pixels.
    const d = PXI[name],
      m = /M\s*(\d+)[ ,]+(\d+)/.exec(d) || [0, 0, 0];

    ctx.save();
    ctx.translate(x - (m[1] % 2) / 2, y - (m[2] % 2) / 2);
    ctx.scale(0.5, 0.5);
    ctx.fill(new Path2D(d));
    ctx.restore();
  }

  // Draws the floating name labels above the zones on the visible side of the globe. The zone he stands on has
  // none (he is there), and a label that would cover another one moves up above it.
  function drawLabels(t, v) {
    ctx.font = `600 12px "Pixelify Sans", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    labelBoxes = [];
    // Nearest zones first, so the ones further round the globe are the ones that move.
    const shown = ZONES.filter((o) => o.at && arc(player.at, o.at) > 4)
      .map((o) => [o, project(o.at, v)])
      .filter(([, p]) => p[2] > 0.05)
      .sort((a, b) => b[1][2] - a[1][2]);

    // Draws one label per zone, over its pin, fading out toward the globe's edge.
    for (const [o, [px, py, d]] of shown) {
      // Label text (with an arrow when hovered), box width and left edge.
      const text = (hover === o.id ? "▸ " : "") + ui(o.place || o.name),
        w = ctx.measureText(text).width + 30,
        near = arc(player.at, o.at) < 9, // a neighbour right under his feet (Tunisia and Malta): label sits beside him
        x0 = Math.round(near ? px + 22 : px - w / 2);

      // Centres the label above the pin with a gentle floating bob, lifted clear of the labels already placed.
      let cy = py - (near ? 34 : 14) + Math.sin(t * 2.4 + px) * 1.6;
      for (let k = 0; k < 4; k++) {
        const hit = labelBoxes.find((b) => x0 < b.x + b.w && b.x < x0 + w && cy - 10 < b.y + b.h && b.y < cy + 10);
        if (!hit) break;
        cy = hit.y - 12;
      }

      ctx.globalAlpha = Math.min(1, d * 4);
      ctx.fillStyle = "rgba(14,10,22,.85)";
      ctx.fillRect(x0, cy - 10, w, 20);
      ctx.fillStyle = hover === o.id ? zoneColor(o, true) : "#f4ead8";
      labelIcon(o.icon, x0 + 6, Math.round(cy) - 6);
      ctx.fillText(text, x0 + 22 + (w - 30) / 2, cy + 1);
      ctx.globalAlpha = 1;
      labelBoxes.push({ id: o.id, x: x0, y: cy - 10, w, h: 20 });
    }
  }

  // Time of the last frame and the running animation clock in seconds.
  let last = performance.now(),
    clock = 0;

  // ===============================================================================================
  // frame()
  // ===============================================================================================

  // Main animation loop: walks the hero over the globe and redraws the scene each frame.
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    stepWalk(dt);
    const v = heroView();
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ROOM_W, ROOM_H);
    drawGlobe(v, clock);
    drawZones(v, clock);
    // Draws the pulsing ring on the globe where the player clicked.
    if (marker) {
      marker.t += dt;
      const [x, y, d] = project(marker.p, v);
      if (d > 0) {
        const r = 4 + Math.abs(Math.sin(marker.t * 4)) * 2;
        ctx.strokeStyle = "#7ff3ff";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.6, r * 1.6 * Math.max(0.3, d), 0, 0, 7);
        ctx.stroke();
      }
    }

    drawLabels(clock, v);
    drawPlayer();
    requestAnimationFrame(frame);
  }

  // ===============================================================================================
  // DIALOGUE BANNER
  // ===============================================================================================

  // True for a zone that opens a panel when he gets there (every zone unless it sets panel: false).
  const hasPanel = (id) => !!zoneById(id) && zoneById(id).panel !== false;
  // True for a zone whose panel content floats over the dimmed room, with the dialogue banner kept up.
  const floats = (id) => hasPanel(id) && !!zoneById(id).float;
  // all text, links and images shown in the panels come from content.json (see docs/content.md)
  const DEFAULT = JSON.parse(document.getElementById("content-default").textContent);
  // A zone may bring the default copy for its own lines (its name, its intro...); content.json still wins.
  for (const z of ZONES)
    for (const [type, lines] of Object.entries(z.copy || {}))
      DEFAULT.ui[type] = { ...lines, ...DEFAULT.ui[type] };

  let CONTENT = DEFAULT;
  const LINES = {};

  // ===============================================================================================
  // LANGUAGE AND UI COPY
  // ===============================================================================================

  // every piece of room text lives in content.json: section copy in its section, the rest under "ui",
  // grouped by type. A translatable value is a plain string or { en, aeb, fr, de }; English fills the gaps.
  let LANG = "en";
  // Restores the language chosen on a previous visit, if storage allows.
  try {
    LANG = localStorage.getItem("lang") || "en";
  } catch (e) {}

  if (!LANGS.some((l) => l.code === LANG)) LANG = "en";
  // The current language's text from a translatable value.
  const tr = (v) => (v && typeof v === "object" ? v[LANG] || v.en || "" : v || "");
  // Finds a UI copy entry by id in a ui block.
  const uiEntry = (block, id) => Object.values(block || {}).find((g) => g && g[id])?.[id];
  // older content.json files kept the dialogue intros inside their sections
  const LEGACY = { "projects.intro": "projects", "cv.intro": "cv", "contact.intro": "contact" };
  // A UI line in the current language: content.json, then an older intro field, then the built-in default.
  // {name}-style slots are filled from vars.
  function ui(id, vars) {
    // Looks up the line in content.json, then a legacy intro, then the built-in default.
    let e = uiEntry(CONTENT.ui, id),
      t = e ? tr(e.text) : "";

    if (!t && LEGACY[id] && CONTENT[LEGACY[id]]) t = tr(CONTENT[LEGACY[id]].intro);
    if (!t) t = tr((uiEntry(DEFAULT.ui, id) || { text: "" }).text);
    return t.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
  }

  // One shortcut button per zone in the header nav, before its hint (none for shortcut: false or panel: false).
  const nav = document.querySelector(".app nav");
  const quick = document.querySelector(".title-quick");
  // Adds the zone's button, and its twin in the start screen's quick links; applyStatic() writes their names.
  ZONES.filter((z) => z.shortcut !== false && z.panel !== false).forEach((z) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.open = z.id;
    nav.insertBefore(b, nav.querySelector("small"));
    if (quick) quick.append(b.cloneNode());
  });

  // Sets an attribute on the first element matching a selector, if it is there.
  const attr = (sel, a, v) => document.querySelector(sel)?.setAttribute(a, v);
  // ===============================================================================================
  // applyStatic()
  // ===============================================================================================

  // Writes every fixed piece of page text (titles, buttons, hints, screen-reader names) in the current language.
  function applyStatic() {
    const parts = ui("site.name").split(/[{}]/); // "Portfolio {Room}": the braced part is amber
    // Writes the site name into the header and title screen, braced part highlighted.
    document.querySelectorAll("header h1, .title-name").forEach((h) => {
      const s = document.createElement("span");
      s.textContent = parts[1] || "";
      h.replaceChildren(parts[0] || "", s, parts.slice(2).join(""));
    });

    document.querySelectorAll(".title-hint .mouse").forEach((x) => (x.textContent = ui("start.click")));
    document.querySelectorAll(".title-hint .touch").forEach((x) => (x.textContent = ui("start.tap")));
    document
      .querySelectorAll("nav [data-open], .title-quick [data-open]")
      .forEach((b) => (b.textContent = ui(zoneById(b.dataset.open).name)));
    document.querySelectorAll(".title-quick small").forEach((x) => (x.textContent = ui("start.quick")));
    const back = document.getElementById("close");
    back.replaceChildren(pxi("arrow-left"), ui("panel.back"));
    back.setAttribute("aria-label", ui("sr.back"));
    document.querySelector(".banner-name").textContent = ui("banner.name");
    attr(".banner-portrait", "alt", ui("sr.portrait"));
    attr("#c", "aria-label", ui("sr.room"));
    attr(".app nav", "aria-label", ui("sr.shortcuts"));
    attr("#title", "aria-label", ui("sr.start"));
    attr(".title-load", "aria-label", ui("sr.loading"));
    document.documentElement.lang = LANG;
    document.querySelectorAll(".flagpick").forEach((p) => p.refresh());
  }

  // Copies content.json (or the built-in placeholder) into each zone's dialogue lines, the page text, title and
  // description.
  function applyContent() {
    ZONES.forEach((z) => (LINES[z.id] = [ui(z.intro)]));
    const site = CONTENT.site || {};
    if (tr(site.title)) document.title = tr(site.title);
    const d = document.querySelector('meta[name="description"]');
    if (d && tr(site.description)) d.content = tr(site.description);
    applyStatic();
  }

  applyContent();
  // Returns the url only when it is http(s), mailto, tel or a relative path; anything else becomes empty.
  const safeUrl = (u) => (/^(https?:|mailto:|tel:|\.{0,2}\/?[\w%-][\w%./-]*$)/i.test(u || "") ? u : "");
  // Creates an element with an optional class and text content (text only, never HTML).
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // True for a video file path (MP4 or WebM).
  const isVid = (p) => /\.(mp4|webm)(\?|#|$)/i.test(p || "");
