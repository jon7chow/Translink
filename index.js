const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

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

    // Updated selector: table rows in schedule table
    $("table.schedule tbody tr").each((i, row) => {
      const tds = $(row).find("td");
      if (tds.length < 3) return;

      const route = $(tds[0]).text().trim();
      const direction = $(tds[1]).text().trim();
      const timeStr = $(tds[2]).text().trim();

      if (route === ROUTE_NUM && direction.includes(DESTINATION)) {
        // Convert time string (e.g., "06:10") to a Date today
        const [hour, minute] = timeStr.split(":").map(Number);
        const now = new Date();
        const busTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hour,
          minute
        );

        // If the bus time is earlier than now, skip (already departed)
        if (busTime > now) {
          const countdown = Math.round((busTime - now) / 60000); // minutes until bus
          buses.push({ time: busTime, countdown });
        }
      }
    });

    // Sort and take next 2 buses
    buses.sort((a, b) => a.time - b.time);
    const next2 = buses.slice(0, 2);

    // Generate RSS items
    let items = "";
    if (next2.length === 0) {
      items = `
        <item>
          <title>No upcoming buses</title>
          <description>🚌 No scheduled arrivals at this time</description>
          <pubDate>${new Date().toUTCString()}</pubDate>
        </item>
      `;
    } else {
      items = next2
        .map((p) => {
          const minutes = p.countdown <= 0 ? "NOW" : `${p.countdown} min`;
          return `
            <item>
              <title>🚌 ${ROUTE_NUM} → ${DESTINATION} Stn</title>
              <description>⏱ ${minutes} (${p.time.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})})</description>
              <pubDate>${p.time.toUTCString()}</pubDate>
            </item>
          `;
        })
        .join("");
    }

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Bus ${ROUTE_NUM} – Caithness → ${DESTINATION}</title>
          <description>Next 2 departures from stop ${STOP_ID}</description>
          ${items}
        </channel>
      </rss>`;

    res.set("Content-Type", "application/rss+xml");
    res.send(rss);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    res.status(500).send("Error fetching schedule data");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RSS server running on port ${PORT}`);
});
