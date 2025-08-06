// api/forward-to-discord.js
export default async function handler(req, res) {
  // Put your Discord webhook URL here
  const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1402536555465146388/XYh0sDNNH3XBAaxRAjRjGvDIQhzLaXkUkrr900NJCJX2fcxfYltcnXMV2OwWdUBuM-99";

  try {
    // TradingView normally sends plain text. If it's parsed JSON, convert to string.
    let body = req.body;
    if (typeof body === "object") {
      // sometimes a body parser gives an object; stringify it to preserve content
      body = JSON.stringify(body);
    } else if (body === undefined || body === null) {
      body = "";
    }

    // Only forward alerts containing "CISD Formed"
    if (!body.includes("CISD Formed")) {
      return res.status(200).json({ message: "Ignored: not CISD Formed" });
    }

    // Helper to send to Discord with retry for 429
    async function sendToDiscord(content, attempt = 1) {
      const maxAttempts = 4;
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });

      if (response.status === 429 && attempt < maxAttempts) {
        // Discord may include retry info in JSON or headers
        let waitMs = 1000 * Math.pow(2, attempt - 1); // exponential backoff: 1s,2s,4s...
        try {
          const data = await response.json();
          if (data && data.retry_after) {
            // retry_after often in seconds or ms depending on endpoint; assume seconds if small
            const val = Number(data.retry_after);
            if (!Number.isNaN(val)) {
              waitMs = val > 10 ? val : val * 1000; // try best effort
            }
          }
        } catch (e) {
          // ignore parse errors, use backoff
        }
        await new Promise((r) => setTimeout(r, waitMs));
        return sendToDiscord(content, attempt + 1);
      }

      return response;
    }

    // Forward the exact alert text to Discord
    const discordResp = await sendToDiscord(body);

    // If still error, surface it
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
