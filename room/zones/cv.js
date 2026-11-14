// =================================================================================================
// CANADA ZONE
// =================================================================================================

// Canada: a two-column chapter spread, the story on the left and the itinerary of stops on the right.
// chapterSpread() and itinerary() below are shared with Malta and Tunisia.
zone({
  // <zone-settings> written by the editor's Zones page; edit it there, or by hand keeping both marker lines
  id: "cv", // panel id: shortcut button, dialogue and room.css rules ([data-panel="cv"])
  name: "name.cv", // UI copy id of its shortcut button and panel title
  place: "place.cv", // UI copy id of its label on the globe
  intro: "cv.intro", // UI copy id of the hero's line when he gets there
  icon: "flag", // Pixelarticon in front of its room label
  float: true, // the content floats over the dimmed room while the dialogue banner stays up
  country: "Canada", // the country that glows and takes taps (its name in assets/countries.json)
  at: [57, -103], // where he stands, [lat, lon]: the globe turns this spot under his feet
  // </zone-settings>

  // Builds the Canada spread from CONTENT.cv.
  build() {
    return chapterSpread(CONTENT.cv, itinerary(CONTENT.cv.stops));
  },
});

// =================================================================================================
// chapterSpread()
// =================================================================================================

// Builds a chapter spread from data C: { span, summary, facts: [{label, value}], pdf }. The left column holds the
// years, the story, the key facts and the CV download; `right` (an element) fills the right column.
function chapterSpread(C, right) {
  const f = document.createDocumentFragment(),
    spread = el("div", "spread"),
    side = el("div", "spread-side");

  if (tr(C.span)) side.append(el("p", "spread-span", tr(C.span)));
  if (tr(C.summary || C.story)) side.append(el("p", "spread-lede", tr(C.summary || C.story)));

  // Key facts as a definition list: a quiet label above each value.
  if ((C.facts || []).length) {
    const dl = el("dl", "spread-facts");
    C.facts.forEach((x) => dl.append(el("dt", null, tr(x.label)), el("dd", null, tr(x.value))));
    side.append(dl);
  }

  const pdf = safeUrl(tr(C.pdf));
  if (pdf) {
    const a = el("a", "spread-cv", ui("cv.download"));
    a.prepend(pxi("download", 16));
    a.href = pdf;
    a.download = "";
    side.append(a);
  }

  spread.append(side, right);
  f.append(spread);
  return f;
}

// =================================================================================================
// itinerary()
// =================================================================================================

// Builds the right column: one stop per entry along a vertical rail, in time order. Each stop:
//   { name, logo, initials, accent, from, to, where, role, points: [], tags: [], url, say }
// The logo tile shows the logo when the file loads, and the initials when it is missing.
function itinerary(stops) {
  const ol = el("ol", "itin");
  (stops || []).forEach((s, i) => {
    const li = el("li", "stop");
    li.style.setProperty("--accent", s.accent || "#f2b04a");
    li.style.setProperty("--i", i);
    li.tabIndex = 0;
    if (tr(s.say)) li.dataset.say = tr(s.say); // the hero's line while this stop is hovered

    // Dates on the rail: start above end, so the timeline reads top to bottom.
    const when = el("div", "stop-when");
    when.append(el("span", null, tr(s.from) || tr(s.when)));
    if (tr(s.to)) when.append(el("span", "stop-to", tr(s.to)));

    // Logo tile, then name, role and place.
    const tile = el("span", "stop-logo");
    tile.append(el("span", "stop-ini", s.initials || (s.name || "?").slice(0, 2).toUpperCase()));
    if (s.logo) {
      const im = el("img");
      im.alt = "";
      im.addEventListener("load", () => tile.classList.add("has-logo"));
      im.addEventListener("error", () => im.remove());
      im.src = s.logo;
      tile.append(im);
    }

    const head = el("div", "stop-head"),
      who = el("div", "stop-who");
    who.append(el("h3", "stop-name", s.name));
    if (tr(s.role)) who.append(el("p", "stop-role", tr(s.role)));
    if (s.where) who.append(el("p", "stop-where", s.where));
    head.append(tile, who);

    const body = el("div", "stop-body");
    body.append(head);

    // What happened there, as short bullet points (or the older one-paragraph story).
    if ((s.points || []).length) {
      const ul = el("ul", "stop-points");
      s.points.forEach((p) => ul.append(el("li", null, tr(p))));
      body.append(ul);
    } else if (tr(s.story)) body.append(el("p", "stop-story", tr(s.story)));

    // Tools as a plain comma list, and the organization's website.
    const foot = el("div", "stop-foot");
    if ((s.tags || []).length) foot.append(el("span", "stop-tags", s.tags.join(", ")));
    const url = safeUrl(s.url);
    if (url) {
      const a = el("a", "stop-link", url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""));
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      foot.append(a);
    }

    if (foot.childNodes.length) body.append(foot);
    li.append(when, body);
    ol.append(li);
  });

  return ol;
}
