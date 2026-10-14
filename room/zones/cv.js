// =================================================================================================
// CANADA ZONE
// =================================================================================================

// Canada: the route of stops (college, internships, first job), each a paper ticket with a stamp on top.
// routePanel() below is shared with Malta.
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

  // Builds the Canada panel from CONTENT.cv.
  build() {
    return routePanel(CONTENT.cv);
  },
});

// =================================================================================================
// routePanel()
// =================================================================================================

// Builds a chapter as a travel route: an intro line, then one ticket per stop, left to right in time order,
// joined by a dashed flight path. Data C: { summary, stops: [...], pdf }. Each stop:
//   { id, name, logo, initials, accent, when, where, role, story, tags: [], url, say }
// The stamp shows the logo when the file loads, and the initials when it is missing.
function routePanel(C) {
  const f = document.createDocumentFragment(),
    wrap = el("div", "route");

  // Intro line and the CV download, on one row above the tickets.
  const top = el("div", "route-top");
  if (tr(C.summary)) top.append(el("p", "route-intro", tr(C.summary)));
  const pdf = safeUrl(tr(C.pdf));
  if (pdf) {
    const a = el("a", "route-cv", ui("cv.download"));
    a.prepend(pxi("download", 18));
    a.href = pdf;
    a.download = "";
    top.append(a);
  }
  wrap.append(top);

  // The row of tickets, with the flight path drawn behind the stamps.
  const row = el("ol", "route-stops");
  (C.stops || []).forEach((s, i) => {
    const li = el("li", "stop");
    li.style.setProperty("--accent", s.accent || "#ffb347");
    li.style.setProperty("--i", i);
    li.tabIndex = 0;
    if (tr(s.say)) li.dataset.say = tr(s.say); // the hero's line while this ticket is hovered

    // The stamp: logo image, or the initials when there is no logo (or it fails to load).
    const stamp = el("div", "stamp");
    const ini = el("span", "stamp-ini", s.initials || (s.name || "?").slice(0, 2).toUpperCase());
    stamp.append(ini);
    if (s.logo) {
      const im = el("img");
      im.alt = "";
      im.addEventListener("load", () => stamp.classList.add("has-logo"));
      im.addEventListener("error", () => im.remove());
      im.src = s.logo;
      stamp.append(im);
    }
    li.append(stamp);

    // The ticket: when and where, name, role, story, tags, website.
    const card = el("div", "ticket");
    card.append(el("p", "ticket-when", [tr(s.when), tr(s.where)].filter(Boolean).join(" · ")));
    card.append(el("h3", "ticket-name", s.name));
    if (tr(s.role)) card.append(el("p", "ticket-role", tr(s.role)));
    if (tr(s.story)) card.append(el("p", "ticket-story", tr(s.story)));
    if ((s.tags || []).length) {
      const tags = el("div", "ticket-tags");
      s.tags.forEach((t) => tags.append(el("span", null, t)));
      card.append(tags);
    }
    const url = safeUrl(s.url);
    if (url) {
      const a = el("a", "ticket-link", url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""));
      a.prepend(pxi("link", 14));
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      card.append(a);
    }
    li.append(card);
    row.append(li);
  });

  wrap.append(row);
  f.append(wrap);
  return f;
}
