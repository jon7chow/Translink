const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { DateTime } = require("luxon");

const app = express();

const STOP_ID = "53204";
const ROUTE_NUM = "180";
const DESTINATION = "Lougheed";

app.get("/rss", async (req, res) => {
  try {
    const url = `https://www.translink.ca/schedules-and-maps/stop/${STOP_ID}/schedule?pageSize=5`;
    console.log("Fetching schedule page:", url);

    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const buses = [];

    // Scrape table rows
    $("table.schedule tbody tr").each((i, row) => {
      const tds = $(row).find("td");
      if (tds.length < 3) return;

      const route = $(tds[0]).text().trim();
      const direction = $(tds[1]).text().trim();
      const timeStr = $(tds[2]).text().trim();

      if (route === ROUTE_NUM && direction.includes(DESTINATION)) {
        // Parse schedule time in Pacific Time
        const [hour, minute] = timeStr.split(":").map(Number);
        const nowPT = DateTime.now().setZone("America/Vancouver");
        let busTime = DateTime.fromObject(
          { year: nowPT.year, month: nowPT.month, day: nowPT.day, hour, minute },
          { zone: "America/Vancouver" }
        );

        // If bus already departed, skip it or roll over to next day
        if (busTime < nowPT) busTime = busTime.plus({ days: 1 });

        const countdown = Math.round(busTime.diff(nowPT, "minutes").minutes);
        buses.push({ time: busTime, countdown });
      }
    });

    buses.sort((a, b) => a.time - b.time);
    const next2 = buses.slice(0, 2);

    // Compact single-line display for DAKboard
    let displayLine = "";
    if (next2.length === 0) {
      displayLine = "🚌 No upcoming buses";
    } else {
      displayLine =
        `🚌 ${ROUTE_NUM} → ${DESTINATION}: ` +
        next2.map((p) => (p.countdown <= 0 ? "NOW" : `${p.countdown} min`)).join(" | ");
    }

    // Single RSS item
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bus ${ROUTE_NUM} – Caithness → ${DESTINATION}</title>
    <description>Next 2 departures from stop ${STOP_ID}</description>
    <item>
      <title>${displayLine}</title>
      <description>${displayLine}</description>
      <pubDate>${DateTime.now().setZone("America/Vancouver").toUTC().toRFC2822()}</pubDate>
    </item>
  </channel>
</rss>`;

    res.set("Content-Type", "application/rss+xml");
    res.send(rss);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    res.status(500).send("Error fetching schedule data");
  }
});

// REQUIRED for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RSS server running on port ${PORT}`);
});
