const express = require('express');
const fetch = require('node-fetch');

const app = express();

const API_KEY = '2oIEwpizAB7ssiANdujO'; // Replace with your actual TransLink RTTI API key
const STOP_ID = '53204';

app.get('/rss', async (req, res) => {
  try {
    const url = `https://api.translink.ca/rttiapi/v1/stops/${STOP_ID}/estimates.json?apikey=${API_KEY}&count=6&timeframe=60`;

    // Fetch from TransLink with proper User-Agent
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TranslinkRSS/1.0 jonathan.g.chow@gmail.com'
      }
    });

    const rawText = await response.text();
    console.log("RAW RESPONSE:", rawText); // <-- logs raw API response

    let data;
    try {
      data = JSON.parse(rawText); // Try parsing JSON
    } catch (err) {
      console.error("Failed to parse JSON. Likely invalid API key or HTML response.");
      return res.status(500).send('Error fetching data (invalid API key or API returned HTML)');
    }

    // Filter for route 180 → Lougheed
    let schedules = data
      .filter(route =>
        route.RouteNo === "180" &&
        route.Direction.includes("Lougheed")
      )
      .flatMap(route => route.Schedules);

    // Sort by soonest
    schedules.sort((a, b) => a.ExpectedCountdown - b.ExpectedCountdown);

    // Take next 2 buses
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
    res.status(500).send('Error fetching data (unexpected error)');
  }
});

// REQUIRED for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RSS server running on port ${PORT}`);
});
