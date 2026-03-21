const express = require("express");
const fetch = require("node-fetch");
const pdfParse = require("pdf-parse");
const { DateTime } = require("luxon");

const app = express();

const PDF_URL = "https://infomaps.translink.ca/Public_Timetables/213/tt180.pdf";

app.get("/rss", async (req, res) => {
  try {
    console.log("Fetching PDF...");

    const response = await fetch(PDF_URL);
    const buffer = await response.arrayBuffer();

    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    const now = DateTime.now().setZone("America/Vancouver");

    // Determine which schedule to use
    let section;
    if (now.weekday <= 5) section = "MONDAY TO FRIDAY";
    else if (now.weekday === 6) section = "SATURDAY";
    else section = "SUNDAY";

    console.log("Using section:", section);

    // Extract relevant section of text
    const sectionStart = text.indexOf(section);
    const nextSectionIndex = text.indexOf("SUNDAY", sectionStart + 10);

    const sectionText =
      nextSectionIndex > sectionStart
        ? text.substring(sectionStart, nextSectionIndex)
        : text.substring(sectionStart);

    // Split lines
    const lines = sectionText.split("\n").map((l) => l.trim()).filter(Boolean);

    const times = [];

    lines.forEach((line) => {
      // Split by spaces (PDF columns)
      const parts = line.split(/\s+/);

      // We want columns 4, 7, 10 (index 3,6,9)
      [3, 6, 9].forEach((idx) => {
        if (parts[idx]) {
          let t = parts[idx].replace(".", ":");

          // Validate time
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

            // If already passed, skip
            if (busTime > now) {
              times.push(busTime);
            }
          }
        }
      });
    });

    // Sort and take next 2
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
            const diff = Math.round(t.diff(now, "minutes").minutes);
            return diff <= 0 ? "NOW" : `${diff} min`;
          })
          .join(" | ");
    }

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bus 180 – Burquitlam → Lougheed</title>
    <description>Next buses from timetable PDF</description>
    <item>
      <title>${display}</title>
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
