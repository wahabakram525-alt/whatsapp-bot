import express from "express";
import twilio from "twilio";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ====== ENV VARS (SET THESE IN RENDER) ======
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. "whatsapp:+14155238886"
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP;          // your own WA: "whatsapp:+92...."

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

// ====== SIMPLE IN-MEMORY STORAGE ======
const sessions = {};  // conversation state per user
const bookings = [];  // all bookings

function sendWhatsApp(to, body) {
  return client.messages.create({
    from: TWILIO_WHATSAPP,
    to,
    body,
  });
}

// ====== HELPERS ======
function formatBookings(list) {
  return list
    .map(
      (b, i) =>
        `${i + 1}. ${b.date} at ${b.time} — ${b.service} (${b.name || b.client})`
    )
    .join("\n");
}

// ====== HOME (OPTIONAL) ======
app.get("/", (req, res) => {
  res.send("📸 Photography WhatsApp Bot is running.");
});

// ====== MAIN WEBHOOK ======
app.post("/webhook", async (req, res) => {
  const from = req.body.From;                 // whatsapp:+1608...
  const name = req.body.ProfileName || "Friend";
  const body = (req.body.Body || "").trim();

  console.log("📩 Incoming:", { from, name, body });

  if (!from || !body) {
    return res.send("OK");
  }

  // Get or init session
  let session = sessions[from] || { step: "idle", temp: {} };

  let reply = "";

  // --- BOOKING FLOW STEPS ---
  if (session.step === "ask_date") {
    session.temp.date = body;
    session.step = "ask_time";
    reply = `Great, ${name}! What *time* do you want? (e.g. 5:00 PM)`;
  } else if (session.step === "ask_time") {
    session.temp.time = body;
    session.step = "ask_service";
    reply = `Nice. What *type of session* is this? (e.g. Wedding, Birthday, Studio Shoot)`;
  } else if (session.step === "ask_service") {
    session.temp.service = body;

    const booking = {
      client: from,
      name,
      date: session.temp.date,
      time: session.temp.time,
      service: session.temp.service,
      createdAt: new Date().toISOString(),
    };
    bookings.push(booking);

    reply =
      `✅ Your session is booked!\n\n` +
      `📅 Date: ${booking.date}\n` +
      `⏰ Time: ${booking.time}\n` +
      `📸 Service: ${booking.service}\n\n` +
      `If you want to see your bookings, type *my bookings*.`;

    // reset session
    session = { step: "idle", temp: {} };
  }

  // --- IF NOT IN A FLOW, HANDLE COMMANDS ---
  else if (/^menu$/i.test(body)) {
    reply =
      `Hi ${name}! 👋 I can help you with:\n\n` +
      `1️⃣ *Booking* a session — type: book\n` +
      `2️⃣ *Our services & prices* — type: prices\n` +
      `3️⃣ *Studio location* — type: location\n` +
      `4️⃣ *See your bookings* — type: my bookings\n`;
    session = { step: "idle", temp: {} };
  }

  else if (/book|booking|schedule/i.test(body)) {
    reply =
      `Awesome, ${name}! Let's book your session.\n\n` +
      `Please send the *date* in this format: YYYY-MM-DD\n` +
      `Example: 2025-11-30`;
    session = { step: "ask_date", temp: {} };
  }

  else if (/my booking|my bookings|my schedule/i.test(body)) {
    const my = bookings.filter((b) => b.client === from);
    if (!my.length) {
      reply = `You don't have any bookings yet, ${name}. Type *book* to schedule a session.`;
    } else {
      reply =
        `📅 Your bookings:\n\n` +
        formatBookings(my) +
        `\n\nIf you want to book another, type *book*.`;
    }
    session = { step: "idle", temp: {} };
  }

  // --- FAQ / ANSWERING QUESTIONS ---
  else if (/price|charges|rates|package/i.test(body.toLowerCase())) {
    reply =
      `📸 *Our Photography Packages*\n\n` +
      `• Basic (1 hour): Rs 8,000\n` +
      `• Standard (2 hours): Rs 15,000\n` +
      `• Premium (Half-day): Rs 25,000\n\n` +
      `Includes edited photos + online album.\n` +
      `Type *book* to schedule a session.`;
  }

  else if (/location|address/i.test(body.toLowerCase())) {
    reply =
      `📍 *Studio Location*\n` +
      `XYZ Studio, Lahore\n` +
      `Google Maps: https://maps.google.com\n\n` +
      `Type *book* to schedule a session.`;
  }

  else if (/service|services|what do you do/i.test(body.toLowerCase())) {
    reply =
      `📸 *Our Services*\n\n` +
      `• Wedding & Engagement Shoots\n` +
      `• Birthday & Event Coverage\n` +
      `• Studio Portraits & Family Shoots\n` +
      `• Product Photography\n\n` +
      `Type *prices* to see packages or *book* to schedule.`;
  }

  else {
    // default fallback
    reply =
      `Hi ${name}! 😊 I'm your photography assistant.\n\n` +
      `You can type:\n` +
      `• *book* – to book a session\n` +
      `• *prices* – to see packages\n` +
      `• *location* – to get studio address\n` +
      `• *my bookings* – to see your bookings\n` +
      `• *menu* – to see all options again`;
  }

  // save session
  sessions[from] = session;

  // send reply
  try {
    await sendWhatsApp(from, reply);
  } catch (err) {
    console.error("❌ Error sending WhatsApp:", err?.message || err);
  }

  res.send("OK");
});

// ====== DAILY AGENDA (CALL THIS AT 8AM VIA CRON PING) ======
app.get("/daily-agenda", async (req, res) => {
  if (!ADMIN_WHATSAPP) {
    return res.status(500).send("ADMIN_WHATSAPP not set");
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const todayBookings = bookings.filter((b) => b.date === today);

  let text = `📅 *Today's bookings* (${today})\n\n`;

  if (!todayBookings.length) {
    text += `No bookings today.`;
  } else {
    text += formatBookings(todayBookings);
  }

  try {
    await sendWhatsApp(ADMIN_WHATSAPP, text);
    res.send("Daily agenda sent.");
  } catch (err) {
    console.error("❌ Error sending daily agenda:", err?.message || err);
    res.status(500).send("Failed to send agenda");
  }
});

// ====== START SERVER ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Bot running on port " + PORT);
});

