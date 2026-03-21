const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();

const STOP_ID = "53204";
const ROUTE_NUM = "180";
const DESTINATION = "Lougheed"; // used to filter the route direction

app.get("/rss", async (req, res) => {
  try {
    const url = `https://www.translink.ca/schedules-and-maps/stop/${STOP_ID}/schedule?pageSize=5`;
    console.log("Fetching schedule page:", url);

    const response = await fetch(url);
    const html = await response.text();

    const $ = cheerio.load(html);

    // Find the table rows that contain route 180 → Lougheed
    const buses = [];
    $("table.table tbody tr").each((i, row) => {
      const route = $(row).find("td.route").text().trim();
      const direction = $(row).find("td.direction").text().trim();
      const time = $(row).find("td.time").text().trim();

      if (route === ROUTE_NUM && direction.includes(DESTINATION)) {
        buses.push(time);
      }
    });

    // Take next 2 buses
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
        .map((time) => {
          return `
            <item>
              <title>🚌 ${ROUTE_NUM} → ${DESTINATION} Stn</title>
              <description>⏱ ${time}</description>
              <pubDate>${new Date().toUTCString()}</pubDate>
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

// REQUIRED for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RSS server running on port ${PORT}`);
});
