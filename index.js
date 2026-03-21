const express = require("express");
const { DateTime } = require("luxon");

const app = express();

// ===== TIMETABLE DATA =====
const weekdayTimes = [
"12:15 AM","4:56 AM","5:15 AM","5:35 AM","5:56 AM","6:14 AM","6:31 AM","6:45 AM","6:59 AM","7:16 AM",
"7:34 AM","7:48 AM","8:04 AM","8:20 AM","8:37 AM","8:52 AM","9:09 AM","9:26 AM","9:40 AM","9:56 AM",
"10:15 AM","10:27 AM","10:42 AM","10:57 AM","11:12 AM","11:27 AM","11:42 AM","11:57 AM",
"12:12 PM","12:27 PM","12:42 PM","12:57 PM","1:12 PM","1:27 PM","1:42 PM","1:57 PM",
"2:12 PM","2:27 PM","2:51 PM","3:18 PM","3:36 PM","3:51 PM","4:05 PM","4:21 PM",
"4:37 PM","4:51 PM","5:06 PM","5:21 PM","5:36 PM","5:51 PM","6:06 PM","6:21 PM",
"6:36 PM","6:52 PM","7:05 PM","7:17 PM","7:36 PM","7:56 PM","8:15 PM","8:35 PM",
"8:55 PM","9:15 PM","9:35 PM","9:55 PM","10:15 PM","10:45 PM","11:14 PM","11:44 PM"
];

const saturdayTimes = [
"12:15 AM","6:18 AM","6:48 AM","7:19 AM","7:49 AM","8:20 AM","8:50 AM","9:21 AM","9:53 AM","10:23 AM",
"10:41 AM","11:01 AM","11:22 AM","11:41 AM","12:01 PM","12:21 PM","12:41 PM","1:01 PM","1:21 PM",
"1:41 PM","2:02 PM","2:22 PM","2:42 PM","3:02 PM","3:22 PM","3:42 PM","4:02 PM","4:22 PM",
"4:42 PM","5:01 PM","5:16 PM","5:41 PM","6:00 PM","6:14 PM","6:50 PM","7:15 PM","7:50 PM",
"8:20 PM","8:50 PM","9:20 PM","9:50 PM","10:19 PM","10:44 PM","11:19 PM"
];

const sundayTimes = [
"7:20 AM","7:50 AM","8:21 AM","9:21 AM","9:51 AM","9:52 AM","10:22 AM","10:42 AM","11:02 AM",
"11:23 AM","11:42 AM","11:57 AM","12:19 PM","12:39 PM","12:59 PM","1:19 PM","1:39 PM",
"1:59 PM","2:17 PM","2:37 PM","2:57 PM","3:17 PM","3:37 PM","3:57 PM","4:17 PM",
"4:37 PM","4:57 PM","5:17 PM","5:42 PM","6:02 PM","6:22 PM","6:42 PM","7:02 PM",
"7:32 PM","8:01 PM","8:29 PM","8:49 PM","9:28 PM","9:58 PM","10:28 PM","10:58 PM","11:28 PM"
];

// ===== BC HOLIDAYS =====
function isBCHoliday(date) {
  const y = date.year;

  const fixed = [
    `${y}-01-01`,
    `${y}-07-01`,
    `${y}-12-25`
  ];

  // Labour Day
  let labour = DateTime.fromObject({ year: y, month: 9, day: 1 });
  while (labour.weekday !== 1) labour = labour.plus({ days: 1 });

  // Thanksgiving
  let thanks = DateTime.fromObject({ year: y, month: 10, day: 1 });
  let count = 0;
  while (count < 2) {
    if (thanks.weekday === 1) count++;
    if (count < 2) thanks = thanks.plus({ days: 1 });
  }

  return (
    fixed.includes(date.toISODate()) ||
    date.toISODate() === labour.toISODate() ||
    date.toISODate() === thanks.toISODate()
  );
}

// ===== PICK TODAY'S SCHEDULE =====
function getTodaySchedule(now) {
  if (isBCHoliday(now) || now.weekday === 7) return sundayTimes;
  if (now.weekday === 6) return saturdayTimes;
  return weekdayTimes;
}

// ===== MAIN ENDPOINT =====
app.get("/rss", (req, res) => {
  try {
    const now = DateTime.now().setZone("America/Vancouver");

    const schedule = getTodaySchedule(now);

    const upcoming = schedule
      .map((t) => {
        const time = DateTime.fromFormat(t, "h:mm a", {
          zone: "America/Vancouver"
        }).set({
          year: now.year,
          month: now.month,
          day: now.day
        });

        return time;
      })
      .filter((t) => t > now)
      .sort((a, b) => a - b)
      .slice(0, 2);

    let display;

    if (upcoming.length === 0) {
      display = "🚌 No upcoming buses";
    } else {
      display =
        "🚌 180 → Caithness to Burquitlam " +
        upcoming
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
    <title>Bus 180 – Caithness to Burquitlam</title>
    <description>Next scheduled buses</description>
    <item>
      <title>${display}</title>
      <description> </description>
      <pubDate>${now.toUTC().toRFC2822()}</pubDate>
    </item>
  </channel>
</rss>`;

    res.set("Content-Type", "application/rss+xml");
    res.send(rss);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating RSS");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
