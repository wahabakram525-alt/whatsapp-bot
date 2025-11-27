
import express from "express";
import twilio from "twilio";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Twilio requires these ENV variables (use your own)
const TWILIO_AUTH_TOKEN = "178bfcfed032fa22a08aeae171b28603";  

// Twilio webhook validation middleware (optional)
app.use((req, res, next) => {
  // Skip validation for local testing
  next();
});

// Home page
app.get("/", (req, res) => {
  res.send("Twilio WhatsApp Bot Running");
});

// Webhook route for Twilio incoming WhatsApp messages
app.post("/webhook", (req, res) => {
  console.log("📩 Incoming message:", req.body);

  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();

  const msgBody = req.body.Body || "";

  // Reply
  twiml.message(`You said: ${msgBody}`);

  res.set("Content-Type", "text/xml");
  res.send(twiml.toString());
});

// Render port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Bot running on port " + PORT);
});
