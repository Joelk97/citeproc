import express from "express";
import { localeEnUS, normalizeCslItem } from "./locale.js";
import CSL from "citeproc";

const app = express();
app.use(express.json({ limit: "1mb" }));

// Endpoint: /create-csl-engine-once
// Expects body: { publicationsById, styleXml, [localeXml] }
app.post("/create-csl-engine-once", async (req, res) => {
  try {
    const { publicationsById, styleXml, localeXml } = req.body;
    if (!publicationsById || !styleXml) {
      return res
        .status(400)
        .json({ error: "Missing publicationsById or styleXml" });
    }

    // Prepare sys object per createCslEngineOnce
    const sys = {
      retrieveItem(id) {
        const raw = publicationsById[id];
        if (!raw) return null;
        return normalizeCslItem(raw);
      },
      retrieveLocale(lang) {
        if (!lang.startsWith("en")) {
          throw new Error(
            `This CSL file requires locale "${lang}", but only "en-US" is currently supported.`
          );
        }
        return (localeXml || localeEnUS).replace(/^\uFEFF/, "");
      },
    };

    // Create citeproc engine
    const engine = new CSL.Engine(sys, styleXml, "en-US", true);

    // We're not performing citation or bibliography output here;
    // if you want to return something, e.g., a bibliography, you can extend this.
    // For demonstration, just return an indication of success.
    res.json({ message: "CSL Engine created successfully" });
  } catch (err) {
    console.error("Error in /create-csl-engine-once:", err);
    res.status(500).json({ error: String(err) });
  }
});

// Endpoint: /create-bibliography-engine
// Expects body: { publications, styleXml }
app.post("/create-bibliography-engine", async (req, res) => {
  try {
    const { publications, styleXml } = req.body;
    if (!publications || !styleXml) {
      return res
        .status(400)
        .json({ error: "Missing publications or styleXml" });
    }

    const sys = {
      retrieveItem(id) {
        const item = publications[id];
        if (!item) {
          console.warn("[CSL] Missing item", id);
        }
        return item;
      },
      retrieveLocale(lang) {
        if (lang === "en-US") {
          return localeEnUS;
        }
        throw new Error("Unsupported locale: " + lang);
      },
    };

    const engine = new CSL.Engine(
      sys,
      styleXml.trim().replace(/^\uFEFF/, ""),
      "en-US"
    );
    engine.updateItems(Object.keys(publications));
    // Let's return the bibliography HTML output as in the original handler
    const bibliography = engine.makeBibliography();

    res.json({ html: bibliography[1].join("") });
  } catch (err) {
    console.error("Error in /create-bibliography-engine:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.get("/health", (_, res) => {
  console.log("Health check requested");
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Citeproc service running on ${PORT}`));
