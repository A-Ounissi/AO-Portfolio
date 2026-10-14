# Globe zones

A zone is a country on the globe the hero can walk to: it glows on hover, has a label, says a line when he
arrives, and opens its own panel (or, with `panel: false`, he just rests there). Each zone is one file in this folder, and one `<script>` line in `index.html`
turns it on:

```html
<!-- Interactive zones: one file each in room/zones/, one line here turns a zone on (see room/zones/README.md) -->
<script src="room/zones/projects.js"></script>
<script src="room/zones/cv.js"></script>
<script src="room/zones/socials.js"></script>
<script src="room/zones/malta.js"></script>
```

The order of these lines is the order of the shortcut buttons under the globe. Zone files load right after
`room-scene.js` and before the rest of the room code, so they only *declare* things; anything that touches the
page runs later, inside the zone's own functions.

## Adding a zone

The easy way is the editor's **Zones** page (`start-editor.bat`, then Zones in the top bar):

1. Type a name in the **New zone** box under the list and press +. The editor creates `room/zones/<id>.js` from the
   template below and adds its `<script>` line to `index.html`.
2. Place it on the globe with the tools: **Turn** (V: drag to turn the globe, click a zone's country or pin to pick
   it, Esc to let go), **Country** (C: click a country to make it the zone's country) and **Spot** (S: click where he
   should stand). The Settings tab has the same as fields (country name, spot as lat/lon, tap radius) plus the icon.
   The wheel zooms, 0 fits the globe back, and **Go to it** turns the globe to the picked zone.
   Press **Save zone file**.
3. Write its name and arrival line in the **Text** tab, then the top bar's Save (and Save + Publish).

Colours on that page tell the two kinds of change apart. **Cyan** is zone code (`room/zones/*.js` and the line in
`index.html`): it is saved with Save zone file and goes live only with a git push, never with Publish. **Gold** is
text (`content.json`): Save, then Save + Publish, as everywhere else in the editor. The thin bar at the bottom of the
page lists the site code waiting for a push; click it for the git command, which sends all of it (never half a change)
and leaves your text to Publish.

The editor only ever rewrites the block between `// <zone-settings>` and `// </zone-settings>` in a zone file. It
checks the file before writing and keeps the old copy in `admin/backups/`. Everything else in the file (its panel,
`build()`, helpers, default text) is yours to write by hand. The red and green **switch** on each zone's row adds or
removes its line in `index.html` and keeps the file. You can still do it all by hand: copy the template below and add
the `<script>` line yourself.

## The fields

| Field      | Needed | What it does                                                                                                                     |
| ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`       | yes    | Short name. Used by the shortcut button, the dialogue, and `room.css` as `.dialog[data-panel="<id>"]`.                           |
| `name`     | yes    | UI copy id of the zone's name: shortcut button and panel title.                                                                  |
| `place`    | no     | UI copy id of its label on the globe (the country's name, like "USA"); `name` is used when left out.                            |
| `intro`    | yes    | UI copy id of what the hero says when he gets there.                                                                                 |
| `icon`     | yes    | Pixelarticon in front of the globe label: a name in the `PXI` map of `icons.js` (copy new ones from `pixelarticons/svg`).          |
| `country`  | yes    | The country that glows and takes taps: its name as `assets/countries.json` spells it (like "United States of America").         |
| `at`       | yes    | `[lat, lon]` where he stands; the globe turns this spot under his feet.                                                          |
| `hit`      | no     | Tap radius around `at`, in degrees (3 if left out). Small countries like Malta are only a pixel or two wide on the globe.        |
| `build()`  | yes\*  | Returns the panel content (a DOM node or fragment). Read text from `CONTENT` with `tr()` and `ui()`; build with `el()`.          |
| `float`    | no     | `true`: the content floats over the dimmed globe and the dialogue banner stays up.                                               |
| `copy`     | no     | Default text for the zone's own lines, shaped like `ui` in `content.json`: `{ titles: { id: {...} }, dialogue: { id: {...} } }`. |
| `css`      | no     | Path of the zone's own stylesheet (`room/zones/<id>.css`), loaded with the zone.                                                 |
| `shortcut` | no     | `false` leaves the zone out of the shortcut buttons.                                                                             |
| `panel`    | no     | `false`: no panel (\*so no `build()`, no shortcut button). He says his line and keeps playing the zone's animation until he walks off. |
| `anim`     | no     | The hero's own animation at this zone instead of the shared reach-in (see below).                                            |
| `opened()` | no     | Runs once the panel is on screen: wire up listeners, draw canvases.                                                              |
| `closed()` | no     | Runs whenever any panel closes: put the zone's own state back (the CV unzooms, Projects closes its detail view).                 |
| `press(e)` | no     | A press on the dimmed backdrop while this zone's panel is open; return `true` to keep the panel open.                            |
| `init()`   | no     | Runs once when the globe starts: room-wide listeners such as resize or keyboard.                                                  |

Helpers declared at the top of a zone file share one global scope with the rest of the globe code, so give them names
that belong to the zone (`routePanel`) to keep two files from clashing.

## The hero's animation at a zone

Without `anim`, every zone plays the hero's idle sheet (`assets/hero-sheet-idle.png`) while the dialogue or panel is
up. With `anim`, the zone plays its own sheet instead:

```js
anim: {
  sheet: "assets/hero-sit.png", // same layout as the other hero sheets: 300x300 frames, 5 per row
  frames: 12, // how many frames the sheet holds
  fps: 8, // speed, frames per second (10 if left out)
  intro: 4, // frames 0-3 play once when he starts (0 if left out)
  loop: [4, 5, 6, 7, 6, 5], // then these repeat while he is busy (every frame after the intro if left out)
  outro: [3, 2, 1, 0], // played once when he stops, before he walks off (nothing if left out)
},
```

`loopFps` and `outroFps` set different speeds for the loop and the outro. If the sheet fails to load, the zone falls
back to the shared animation. A zone with `panel: false` and an `anim` is a "rest" spot: he sits (or lies, or reads)
until you click elsewhere, then plays the outro and walks.

## Template

```js
// =================================================================================================
// JAPAN ZONE
// =================================================================================================

// Japan: walking there opens a shelf of books the owner likes.
zone({
  // <zone-settings> written by the editor's Zones page; edit it there, or by hand keeping both marker lines
  id: "japan", // panel id: shortcut button, dialogue and room.css rules ([data-panel="japan"])
  name: "name.japan", // UI copy id of its shortcut button and panel title
  place: "place.japan", // UI copy id of its label on the globe
  intro: "japan.intro", // UI copy id of the hero's line when he gets there
  icon: "file-text", // Pixelarticon in front of its globe label (new ones go in icons.js, see its header)
  float: true, // the content floats over the dimmed globe while the dialogue banner stays up
  css: "room/zones/japan.css", // the zone's own styles
  country: "Japan", // the country that glows and takes taps (its name in assets/countries.json)
  at: [36.2, 138.3], // where he stands, [lat, lon]: the globe turns this spot under his feet
  hit: 3, // tap radius around the spot, in degrees
  // </zone-settings>

  // Default text of the zone's lines; the editor lists them and content.json overrides them.
  copy: {
    // Shortcut button and panel title, and the label on the globe.
    titles: {
      "name.japan": { section: "global", where: "Japan's shortcut button and panel title.", text: { en: "Books" } },
      "place.japan": { section: "global", where: "Label on the globe over Japan.", text: { en: "Japan" } },
    },

    // What the hero says when he gets there.
    dialogue: {
      "japan.intro": { section: "global", where: "Dialogue when the hero reaches Japan.", text: { en: "Japan, and my shelf." } },
    },
  },

  // Builds the panel content.
  build() {
    const f = document.createDocumentFragment();
    f.append(el("p", "sample-note", "Books go here."));
    return f;
  },
});
```
