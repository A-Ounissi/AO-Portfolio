// =================================================================================================
// CANADA ZONE
// =================================================================================================

// Canada: the chapter story, then one pixel card per stop, left to right in time order.
// routePanel() is shared with Malta; chapterSpread() with Tunisia.
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
    return routePanel(CONTENT.cv);
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
// routePanel()
// =================================================================================================

// Builds a chapter as a row of pixel cards: the years and story with the CV download on top, one card per stop
// joined by a dotted flight path, then the key facts. Data C: { span, summary, facts, pdf, stops: [...] }. Each stop:
//   { name, logo, initials, accent, from, to, where, role, story, tags: [], url, say }
// The logo tile shows the logo when the file loads, and the initials when it is missing.
function routePanel(C) {
  const f = document.createDocumentFragment(),
    wrap = el("div", "route");

  // Years badge, story and the CV download on one row above the cards.
  const top = el("div", "route-top"),
    lead = el("div", "route-lead");
  if (tr(C.span)) lead.append(el("span", "route-span", tr(C.span)));
  if (tr(C.summary)) lead.append(el("p", "route-intro", tr(C.summary)));
  top.append(lead);
  const pdf = safeUrl(tr(C.pdf));
  if (pdf) {
    const a = el("a", "route-cv", ui("cv.download"));
    a.prepend(pxi("download", 16));
    a.href = pdf;
    a.download = "";
    top.append(a);
  }
  wrap.append(top);

  // The row of cards.
  const row = el("ol", "route-stops");
  (C.stops || []).forEach((s, i) => {
    const li = el("li", "stop");
    li.style.setProperty("--accent", s.accent || "#ffb347");
    li.style.setProperty("--i", i);
    li.tabIndex = 0;
    if (tr(s.say)) li.dataset.say = tr(s.say); // the hero's line while this card is hovered

    // Logo tile, overlapping the top of the card.
    const stamp = el("div", "stamp");
    stamp.append(el("span", "stamp-ini", s.initials || (s.name || "?").slice(0, 2).toUpperCase()));
    if (s.logo) {
      const im = el("img");
      im.alt = "";
      im.addEventListener("load", () => stamp.classList.add("has-logo"));
      im.addEventListener("error", () => im.remove());
      im.src = s.logo;
      stamp.append(im);
    }
    li.append(stamp);

    // The card: when and where, name, role, story, tool chips, website.
    const card = el("div", "ticket");
    const when = tr(s.from) ? [tr(s.from), tr(s.to)].filter(Boolean).join(" - ") : tr(s.when);
    card.append(el("p", "ticket-when", when));
    if (s.where) card.append(el("p", "ticket-where", s.where));
    card.append(el("h3", "ticket-name", s.name));
    if (tr(s.role)) card.append(el("p", "ticket-role", tr(s.role)));
    if (tr(s.story)) card.append(el("p", "ticket-story", tr(s.story)));
    const foot = el("div", "ticket-foot");
    if ((s.tags || []).length) {
      const tags = el("div", "ticket-tags");
      s.tags.forEach((t) => tags.append(el("span", null, t)));
      foot.append(tags);
    }
    const url = safeUrl(s.url);
    if (url) {
      const a = el("a", "ticket-link", url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""));
      a.prepend(pxi("link", 14));
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      foot.append(a);
    }
    card.append(foot);
    li.append(card);
    row.append(li);
  });
  wrap.append(row);

  // Key facts under the cards, as small pixel plaques.
  if ((C.facts || []).length) {
    const dl = el("dl", "route-facts");
    C.facts.forEach((x) => {
      const d = el("div");
      d.append(el("dt", null, tr(x.label)), el("dd", null, tr(x.value)));
      dl.append(d);
    });
    wrap.append(dl);
  }

  f.append(wrap);
  return f;
}
