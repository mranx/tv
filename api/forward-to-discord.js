// api/forward-to-discord.js
export default async function handler(req, res) {
  const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1402536555465146388/XYh0sDNNH3XBAaxRAjRjGvDIQhzLaXkUkrr900NJCJX2fcxfYltcnXMV2OwWdUBuM-99";

  try {
    // Get pair from query string
    const pair = req.query.pair || "Unknown Pair";

    // Get the body from TradingView
    let body = req.body;
    if (typeof body === "object" && body !== null) {
      // Try to pick text fields first
      const preferKeys = ["text", "content", "message", "alert_message", "body"];
      for (const k of preferKeys) {
        if (k in body && typeof body[k] === "string" && body[k].trim() !== "") {
          body = body[k];
          break;
        }
      }
      if (typeof body === "object") {
        // Convert object to multiline string
        body = Object.values(body).map(String).join("\n");
      }
    }
    if (body === undefined || body === null) body = "";
    body = String(body);

    // Filter only CISD Formed alerts
    if (!body.toLowerCase().includes("cisd formed")) {
      return res.status(200).json({ message: "Ignored: not CISD Formed" });
    }

    // Final message with pair name in bold
    const finalMessage = `**${pair}**\n${body}`;

    // Helper to send to Discord with retry on rate limit
    async function sendToDiscord(content, attempt = 1) {
      const maxAttempts = 4;
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });

      if (response.status === 429 && attempt < maxAttempts) {
        let waitMs = 1000 * Math.pow(2, attempt - 1);
        try {
          const data = await response.json();
          if (data && data.retry_after) {
            const val = Number(data.retry_after);
            if (!Number.isNaN(val)) {
              waitMs = val > 10 ? val : val * 1000;
            }
          }
        } catch (e) {}
        await new Promise((r) => setTimeout(r, waitMs));
        return sendToDiscord(content, attempt + 1);
      }
      return response;
    }

    // Send to Discord
    const discordResp = await sendToDiscord(finalMessage);

    if (!discordResp.ok) {
      const text = await discordResp.text().catch(() => "");
      return res.status(500).json({
        message: "Failed to send to Discord",
        status: discordResp.status,
        body: text
      });
    }

    return res.status(200).json({ message: "Sent to Discord", status: discordResp.status });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
