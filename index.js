const express = require("express");
const fetch = require("node-fetch");
const pdfParse = require("pdf-parse");
const { DateTime } = require("luxon");

const app = express();

const PDF_URL = "https://infomaps.translink.ca/Public_Timetables/213/tt180.pdf";

// Cache (10 minutes)
let cachedPDF = null;
let lastFetch = 0;
const CACHE_TIME = 10 * 60 * 1000;

// BC Holidays (simple list — can expand later)
function isBCHoliday(date) {
  const y = date.year;

  const holidays = [
    `${y}-01-01`, // New Year’s Day
    `${y}-07-01`, // Canada Day
    `${y}-12-25`, // Christmas
  ];

  // Add variable holidays (approximation)
  // Labour Day (first Monday in September)
  let labourDay = DateTime.fromObject({ year: y, month: 9, day: 1 });
  while (labourDay.weekday !== 1) labourDay = labourDay.plus({ days: 1 });
  holidays.push(labourDay.toISODate());

  // Thanksgiving (second Monday in October)
  let thanksgiving = DateTime.fromObject({ year: y, month: 10, day: 1 });
  let mondays = 0;
  while (mondays < 2) {
    if (thanksgiving.weekday === 1) mondays++;
    if (mondays < 2) thanksgiving = thanksgiving.plus({ days: 1 });
  }
  holidays.push(thanksgiving.toISODate());

  return holidays.includes(date.toISODate());
}

async function getPDFText() {
  const now = Date.now();

  if (cachedPDF && now - lastFetch < CACHE_TIME) {
    console.log("Using cached PDF");
    return cachedPDF;
  }

  console.log("Fetching PDF...");
  const response = await fetch(PDF_URL);
  const buffer = await response.arrayBuffer();

  const pdfData = await pdfParse(buffer);
  cachedPDF = pdfData.text;
  lastFetch = now;

  return cachedPDF;
}

app.get("/rss", async (req, res) => {
  try {
    const text = await getPDFText();

    const now = DateTime.now().setZone("America/Vancouver");

    // Determine schedule type
    let section;
    if (isBCHoliday(now) || now.weekday === 7) {
      section = "SUNDAY";
    } else if (now.weekday === 6) {
      section = "SATURDAY";
    } else {
      section = "MONDAY TO FRIDAY";
    }

    console.log("Using section:", section);

    // Extract section text
    const start = text.indexOf(section);
    const end = text.indexOf("SUNDAY", start + 10);

    const sectionText =
      end > start ? text.substring(start, end) : text.substring(start);

    const lines = sectionText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const times = [];

    lines.forEach((line) => {
      const parts = line.split(/\s+/);

      // Columns 4, 7, 10 (Burquitlam)
      [3, 6, 9].forEach((i) => {
        if (parts[i]) {
          let t = parts[i].replace(".", ":");

          if (/^\d{1,2}:\d{2}$/.test(t)) {
            const [hour, minute] = t.split(":").map(Number);

            let busTime = DateTime.fromObject(
              {
                year: now.year,
                month: now.month,
                day: now.day,
                hour,
                minute,
              },
              { zone: "America/Vancouver" }
            );

            if (busTime > now) {
              times.push(busTime);
            }
          }
        }
      });
    });

    times.sort((a, b) => a - b);
    const next2 = times.slice(0, 2);

    let display;

    if (next2.length === 0) {
      display = "🚌 No upcoming buses";
    } else {
      display =
        "🚌 180 → Lougheed: " +
        next2
          .map((t) => {
            const mins = Math.round(t.diff(now, "minutes").minutes);
            const clock = t.toFormat("h:mm a");
            return mins <= 0 ? `NOW (${clock})` : `${mins} min (${clock})`;
          })
          .join(" | ");
    }

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bus 180 – Burquitlam → Lougheed</title>
    <description>Next buses (PDF timetable)</description>
    <item>
      <title>Bus Times</title>
      <description>${display}</description>
      <pubDate>${now.toUTC().toRFC2822()}</pubDate>
    </item>
  </channel>
</rss>`;

    res.set("Content-Type", "application/rss+xml");
    res.send(rss);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Error generating RSS");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
