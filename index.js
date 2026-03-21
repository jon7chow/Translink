const express = require("express");
const fetch = require("node-fetch");
const GtfsRealtimeBindings = require("gtfs-realtime-bindings");

const app = express();

const API_KEY = process.env.API_KEY; // your TransLink GTFS-RT key
const STOP_ID = "53204";
const ROUTE_NUM = "180";

app.get("/rss", async (req, res) => {
  try {
    const url = `https://gtfsapi.translink.ca/v3/gtfsrealtime?apikey=${API_KEY}`;

    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    // Collect predictions for stop 53204 & route 180
    const predictions = [];

    feed.entity.forEach((entity) => {
      if (entity.tripUpdate) {
        const tripUpdate = entity.tripUpdate;

        // Check if route_id matches
        if (tripUpdate.trip.routeId === ROUTE_NUM) {
          tripUpdate.stopTimeUpdate.forEach((stu) => {
            if (stu.stopId === STOP_ID) {
              const arrival = stu.arrival || stu.departure;
              if (arrival && arrival.time) {
                predictions.push({
                  time: new Date(arrival.time * 1000),
                  countdown: Math.round(
                    (arrival.time * 1000 - Date.now()) / 60000
                  ),
                });
              }
            }
          });
        }
      }
    });

    // Sort & take next 2
    predictions.sort((a, b) => a.time - b.time);
    const next2 = predictions.slice(0, 2);

    const items = next2
      .map((p) => {
        const minutes = p.countdown <= 0 ? "NOW" : `${p.countdown} min`;
        return `
          <item>
            <title>🚌 ${ROUTE_NUM} → Lougheed Stn</title>
            <description>⏱ ${minutes} (${p.time.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })})</description>
            <pubDate>${p.time.toUTCString()}</pubDate>
          </item>
        `;
      })
      .join("");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Bus ${ROUTE_NUM} – Caithness → Lougheed</title>
          <description>Next 2 departures from stop ${STOP_ID}</description>
          ${items}
        </channel>
      </rss>`;

    res.set("Content-Type", "application/rss+xml");
    return res.send(rss);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error fetching data");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RSS server running on port ${PORT}`);
});
