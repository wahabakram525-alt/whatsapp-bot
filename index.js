import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "mybot123";
const WHATSAPP_TOKEN = "EAAX8Kej1xMQBQFZALTtbZBSyzuHjCKNYPOOz6rGZACTSJ3q7aNZBZC99CD90ljX6viMjxj2M2P8NDyblkcfQwvbD9Loe6rbKKBVxQT5GJjpNhvvh6iucYy8qSLNJtnbwZCEz3anOm5hdV6nC2iKzJZCV2aVEgWDySPDT4vRpzijWlESM5a5ZBkCquX4Fm9U3ioN0rooWdPIorpvQzpGR4ZBEBRvlRJZBZCT5PDYCEpnjZCyEzbaj0nZC4KtFIC15Pmnzu5C2oZAB0moy5SVRmRtRIlfehZBCy";
const PHONE_NUMBER_ID = "891614740700828";

// Webhook Verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Receive Messages
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (entry && entry.from) {
      const userPhone = entry.from;
      const text = entry.text?.body || "";

      await axios.post(
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: userPhone,
          text: { body: `You said: ${text}` },
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook Error:", error?.response?.data || error);
    res.sendStatus(500);
  }
});

// ⭐ IMPORTANT FOR RENDER ⭐
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Bot running on port " + PORT);
});
