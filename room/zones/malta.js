// =================================================================================================
// MALTA ZONE
// =================================================================================================

// Malta: the degree chapter, the same route of tickets as Canada (routePanel() lives in cv.js).
zone({
  // <zone-settings> written by the editor's Zones page; edit it there, or by hand keeping both marker lines
  id: "malta", // panel id: shortcut button, dialogue and room.css rules ([data-panel="malta"])
  name: "name.malta", // UI copy id of its shortcut button and panel title
  place: "place.malta", // UI copy id of its label on the globe
  intro: "malta.intro", // UI copy id of the hero's line when he gets there
  icon: "book-open", // Pixelarticon in front of its room label
  float: true, // the content floats over the dimmed room while the dialogue banner stays up
  country: "Malta", // the country that glows and takes taps (its name in assets/countries.json)
  at: [35.9, 14.4], // where he stands, [lat, lon]: the globe turns this spot under his feet
  hit: 3, // tap radius around the spot, in degrees (small countries need one)
  // </zone-settings>

  // Default text of the zone's lines; content.json overrides them.
  copy: {
    titles: {
      "name.malta": { section: "global", where: "Malta's shortcut button and panel title.", text: { en: "Malta" } },
      "place.malta": { section: "global", where: "Label on the globe over Malta.", text: { en: "Malta" } },
    },
    dialogue: {
      "malta.intro": {
        section: "global",
        where: "Dialogue banner when the hero reaches Malta.",
        text: { en: "Malta. The engineering degree." },
      },
    },
  },

  // Builds the Malta panel from CONTENT.malta.
  build() {
    return routePanel(CONTENT.malta || { stops: [] });
  },
});
