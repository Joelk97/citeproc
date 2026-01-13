import express from "express";
import citeproc from "citeproc";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/format", async (req, res) => {
  try {
    const { items, style, locale = "en-US" } = req.body;

    console.log("Received POST /format");
    console.log("Request locale:", locale);
    if (!items || !style) {
      console.warn("Request missing items or style");
      return res.status(400).json({ error: "Missing items or style" });
    }

    // 🔐 Basic CSL sanitization (important)
    let authorizedAuthorsCount = 0;
    for (const id in items) {
      const item = items[id];
      if (Array.isArray(item.author)) {
        const beforeCount = item.author.length;
        item.author = item.author.filter(
          (a) => a && (a.family || a.given || a.literal)
        );
        const afterCount = item.author.length;
        authorizedAuthorsCount += afterCount;
        if (beforeCount !== afterCount) {
          console.log(
            `Filtered authors for item ${id}: ${beforeCount} -> ${afterCount}`
          );
        }
      }
    }
    console.log(
      `CSL sanitization complete. Items received: ${
        Object.keys(items).length
      }. Authors authorized: ${authorizedAuthorsCount}`
    );

    const sys = {
      retrieveItem: (id) => items[id],
      retrieveLocale: () => locale,
    };

    console.log("Instantiating citeproc Engine...");
    const engine = new citeproc.Engine(sys, style);
    engine.updateItems(Object.keys(items));
    console.log("Items updated in citeproc Engine.");

    const bibliography = engine.makeBibliography();
    console.log("Bibliography formatted successfully.");

    res.json({ html: bibliography[1].join("") });
  } catch (err) {
    console.error("Error in /format handler:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.get("/health", (_, res) => {
  console.log("Health check requested");
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Citeproc service running on ${PORT}`));
