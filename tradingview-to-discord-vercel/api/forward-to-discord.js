export default async function handler(req, res) {
  const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1386071196499447939/Db-bo24Uyv9afCL6cbrO50vOMyfY9xNTsdqZCM_hOaLRnqe76bAKDjd0VdA6rW13Lk0A";

  try {
    const plainText = req.body; // TradingView sends plain text

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: plainText })
    });

    res.status(200).json({ message: "Sent to Discord", discordStatus: response.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
