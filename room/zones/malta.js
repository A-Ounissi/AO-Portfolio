// =================================================================================================
// MALTA ZONE
// =================================================================================================

// Malta: the degree chapter. Same paper as Canada, filled from CONTENT.malta (cvPaper() lives in cv.js).
zone({
  // <zone-settings> written by the editor's Zones page; edit it there, or by hand keeping both marker lines
  id: "malta", // panel id: shortcut button, dialogue and room.css rules ([data-panel="malta"])
  name: "name.malta", // UI copy id of its shortcut button and panel title
  place: "place.malta", // UI copy id of its label on the globe
  intro: "malta.intro", // UI copy id of the hero's line when he gets there
  icon: "file-text", // Pixelarticon in front of its room label
  float: true, // the content floats over the dimmed room while the dialogue banner stays up
  country: "Malta", // the country that glows and takes taps (its name in assets/countries.json)
  at: [35.9, 14.4], // where he stands, [lat, lon]: the globe turns this spot under his feet
  hit: 3, // tap radius around the spot, in degrees (small countries need one)
  // </zone-settings>

  // Default text of the zone's lines; the editor lists them and content.json overrides them.
  copy: {
    titles: {
      "name.malta": { section: "global", where: "Malta's shortcut button and panel title.", text: { en: "Malta" } },
      "place.malta": { section: "global", where: "Label on the globe over Malta.", text: { en: "Malta" } },
    },
    dialogue: {
      "malta.intro": {
        section: "global",
        where: "Dialogue banner when the hero reaches Malta.",
        text: { en: "Malta. My software engineering degree, and the capstone." },
      },
    },
  },

  // Builds the Malta panel: the degree paper over the faint bureau.
  build() {
    return cvPaper(CONTENT.malta || { name: "", role: "", placeholder: true });
  },

  // Same wiring as the Canada paper: desk drawing, zoom, text fit and reading strip.
  opened() {
    document.querySelectorAll("#dlg-body canvas.desk").forEach(drawDesk);
    const doc = document.querySelector("#dlg-body .cvdoc");
    if (doc) {
      doc.addEventListener("click", () => cvZoom(!doc.classList.contains("zoom")));
      doc.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cvZoom(!doc.classList.contains("zoom"));
        }
      });
    }
    fitCv();
    if (document.fonts) document.fonts.ready.then(fitCv);
    if (doc) cvLens(doc);
  },

  // Closing the panel puts a zoomed paper back and removes the reading strip.
  closed() {
    cvZoom(false);
    document.querySelector(".cvlens")?.remove();
  },

  // With the paper zoomed, a press outside it only zooms it back out.
  press(e) {
    if (!document.body.classList.contains("cvzoom") || e.target.closest(".cvdoc")) return false;
    cvZoom(false);
    return true;
  },
});
