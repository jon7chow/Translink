const express = require('express');
const fetch = require('node-fetch');

const app = express();

const API_KEY = 'YOUR_API_KEY'; // <-- put your TransLink API key here
const STOP_ID = '53204';

app.get('/rss', async (req, res) => {
  try {
    const url = `https://api.translink.ca/rttiapi/v1/stops/${STOP_ID}/estimates?apikey=${API_KEY}&count=6&timeframe=60`;

    const response = await fetch(url);
    const data = await response.json();

    // Get all schedules for route 180 → Lougheed
    let schedules = data
      .filter(route =>
        route.RouteNo === "180" &&
        route.Direction.includes("Lougheed")
      )
      .flatMap(route => route.Schedules);

    // Sort by soonest bus
    schedules.sort((a, b) => a.ExpectedCountdown - b.ExpectedCountdown);

    // Take next 2 buses only
    schedules = schedules.slice(0, 2);

    const items = schedules.map(s => {
      const time = new Date(s.ExpectedLeaveTime);
      const minutes = s.ExpectedCountdown <= 0 ? "NOW" : `${s.ExpectedCountdown} min`;

      return `
        <item>
          <title>🚌 180 → Lougheed Stn</title>
          <description>⏱ ${minutes} (${time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</description>
          <pubDate>${time.toUTCString()}</pubDate>
        </item>
      `;
    }).join('');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Bus 180 – Caithness → Lougheed</title>
          <description>Next 2 departures from stop 53204</description>
          ${items}
        </channel>
      </rss>`;

    res.set('Content-Type', 'application/rss+xml');
    res.send(rss);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching data');
  }
});

// REQUIRED for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RSS server running on port ${PORT}`);
});
