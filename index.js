import express from "express";
import twilio from "twilio";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ====== ENV VARS (SET THESE IN RENDER) ======
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP = process.env.TWILIO_WHATSAPP_NUMBER; // example: whatsapp:+14155238886
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP;          // your own WhatsApp

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

// ====== SIMPLE STORAGE ======
const sessions = {};
const bookings = [];

function sendWhatsApp(to, body) {
  return client.messages.create({
    from: TWILIO_WHATSAPP,
    to,
    body,
  });
}

function formatBookings(list) {
  return list
    .map(
      (b, i) =>
        `${i + 1}. ${b.date} at ${b.time} — ${b.service} (${b.name || b.client})`
    )
    .join("\n");
}

// ====== HOME ======
app.get("/", (req, res) => {
  res.send("📸 Photography WhatsApp Bot is running.");
});

// ====== MAIN WEBHOOK ======
app.post("/webhook", async (req, res) => {
  const from = req.body.From;
  const name = req.body.ProfileName || "Friend";
  const body = (req.body.Body || "").trim();

  console.log("📩 Incoming:", { from, name, body });

  if (!from || !body) return res.send("OK");

  let session = sessions[from] || { step: "idle", temp: {} };
  let reply = "";

  // ====== BOOKING FLOW ======
  if (session.step === "ask_date") {
    session.temp.date = body;
    session.step = "ask_time";
    reply = `Great, ${name}! What *time* do you want? (e.g. 1:30 PM)`;
  } else if (session.step === "ask_time") {
    session.temp.time = body;
    session.step = "ask_service";
    reply = `Nice. What *package* are you booking? (Kayak / Bamboo Raft / Premium / etc)`;
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
      `✅ *Your booking is confirmed!*\n\n` +
      `📅 Date: ${booking.date}\n` +
      `⏰ Time: ${booking.time}\n` +
      `🌊 Package: ${booking.service}\n\n` +
      `To book more, type *book*.\nTo see your schedule, type *my bookings*.`;

    session = { step: "idle", temp: {} };
  }

  // ====== COMMANDS ======
  else if (/^menu$/i.test(body)) {
    reply =
      `Hi ${name}! 👋 Here is what I can do:\n\n` +
      `• *book* — book a session\n` +
      `• *prices* — see all packages\n` +
      `• *location* — get directions\n` +
      `• *hours* — business hours\n` +
      `• *transport* — transportation\n` +
      `• *edits* — extra edit info\n` +
      `• *my bookings* — see your bookings`;
    session = { step: "idle", temp: {} };
  }

  else if (/book|booking|schedule/i.test(body)) {
    reply =
      `Awesome, ${name}! Let's book your session.\n\n` +
      `Please send the *date* like this:\n` +
      `👉 2025-12-30`;
    session = { step: "ask_date", temp: {} };
  }

  else if (/my booking|my bookings/i.test(body)) {
    const my = bookings.filter((b) => b.client === from);

    if (!my.length) {
      reply = `You have no bookings yet. Type *book* to schedule.`;
    } else {
      reply = `📅 *Your Bookings:*\n\n${formatBookings(my)}`;
    }

    session = { step: "idle", temp: {} };
  }

  // ====== PRICES (FULL OWNER DATA) ======
  else if (/price|charges|rates|package|packages|kayak|bamboo/i.test(body.toLowerCase())) {
    reply =
`🌊 *CLEAR KAYAK RATES*  

🔹 *Individual – $175*  
- Photoshoot  
- Videos  
- Cocktails, Shots or Beverages  
- 40+ Photos & Videos  
- Best 4 edited FREE  

🔹 *Couple – $250*  
- Photoshoot  
- Videos  
- Cocktails, Shots or Beverages  
- 40+ Photos & Videos  
- Best 6 edited FREE  

🔹 *Group (3+ persons) – $160 pp*  
- Photoshoot  
- Videos  
- Cocktails, Shots or Beverages  
- 40+ Photos & Videos  
- Best 4 edited FREE  

🔥 *Add-Ons*  
- Hookah: $40 (Refill $10)  
- Hookah Lounge: $100  
- Lounge: $50  
- Flowers for Kayak: $50  
- Floating Dress: $100  

━━━━━━━━━━━━━━━

🎋 *BAMBOO RAFT RATES*  

🔹 *Individual – $200*  
- Photoshoot  
- Videos  
- Cocktails / Beverages  
- 40+ Photos & Videos  
- Best 4 pics + 1 video edited FREE  

🔹 *Couple – $250*  
- Photoshoot  
- Videos  
- Cocktails / Beverages  
- 40+ Photos & Videos  
- Best 6 pics + 2 videos edited FREE  

🔥 *Add-Ons*  
- Hookah: $40 (Refill $10)  
- Hookah Lounge: $100  
- Lounge: $50  

━━━━━━━━━━━━━━━

💎 *PREMIUM PACKAGE – $350*  
- Photoshoot  
- Videos  
- Cocktails / Beverages  
- 40+ Photos & Videos  
- Best 8 edited FREE  
- Flower Décor  
- Champagne  
- Fruit Tray  

To book, type *book*.`;
  }

  // ====== LOCATION ======
  else if (/location|address|map|where/i.test(body.toLowerCase())) {
    reply =
`📍 *LOCATION*  
Search in Google Maps for: *Diverse Sauzen*  
We are right across the big beach gate.

Map: https://maps.app.goo.gl/p6SP24xCeebAUz8f7

🚕 *Transportation Available*  
Contact Javier (Loyalty Transportation):  
📞 +59995200661`;
  }

  // ====== HOURS ======
  else if (/hours|timing|open|close|opening/i.test(body.toLowerCase())) {
    reply =
`⏰ *BUSINESS HOURS*

Friday: 10 AM – 2 PM  
Saturday: 10 AM – 2 PM  
Sunday: 10 AM – 2 PM  
Monday: 10 AM – 2 PM  
Tuesday: 10 AM – 2 PM  
Wednesday: 10 AM – 2 PM  
Thursday: 10 AM – 2 PM  

We are currently OPEN 🌞`;
  }

  // ====== EXTRA EDITS ======
  else if (/edit|edits|extra edit/i.test(body.toLowerCase())) {
    reply =
`🎨 *EXTRA PHOTO EDITS*

PayPal:  
📩 dushiviews@gmail.com  

💲 *$10 per edit*  
Please write your phone number + number of edits in the description.

⏳ If you don’t receive edits within 4 days, please remind us ❤️`;
  }

  // ====== PAYMENT & BOOKING ======
  else if (/payment|paypal|pay/i.test(body.toLowerCase())) {
    reply =
`📩 *HOW TO BOOK*  

We will send you a PayPal link.  
Once payment is confirmed, your booking is locked in.

Please send:  
• Your full name  
• Your email  
• Preferred date  
• Preferred time`;
  }

  // ====== FALLBACK ======
  else {
    reply =
`Hi ${name}! 👋  
I can help you with:

• *book* — Book a session  
• *prices* — Kayak & Bamboo packages  
• *location* — Directions  
• *hours* — Business hours  
• *transport* — Travel assistance  
• *edits* — Extra edit info  
• *my bookings* — View your bookings  
• *menu* — See all options again`;
  }

  // save session
  sessions[from] = session;

  // send reply
  try {
    await sendWhatsApp(from, reply);
  } catch (err) {
    console.error("❌ Error sending WhatsApp:", err);
  }

  res.send("OK");
});

// ====== DAILY AGENDA (CRON) ======
app.get("/daily-agenda", async (req, res) => {
  if (!ADMIN_WHATSAPP) return res.status(500).send("ADMIN_WHATSAPP missing");

  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = bookings.filter((b) => b.date === today);

  let text = `📅 *Today's Bookings* (${today})\n\n`;

  if (!todayBookings.length) text += "No bookings today.";
  else text += formatBookings(todayBookings);

  try {
    await sendWhatsApp(ADMIN_WHATSAPP, text);
    res.send("Daily agenda sent");
  } catch (err) {
    console.error("❌ Agenda error:", err);
    res.status(500).send("Failed to send agenda");
  }
});

// ====== START SERVER ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Bot running on port " + PORT);
});


