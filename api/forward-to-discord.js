// api/forward-to-discord.js
export default async function handler(req, res) {
  const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1402536555465146388/XYh0sDNNH3XBAaxRAjRjGvDIQhzLaXkUkrr900NJCJX2fcxfYltcnXMV2OwWdUBuM-99";

  try {
    // Get the body and turn it into a clean multiline string while preserving newlines
    let body = req.body;

    // If body is an object (parsed JSON or form), try to extract readable text.
    if (typeof body === "object" && body !== null) {
      // If there is a top-level text/content/message field, prefer that
      const preferKeys = ["text", "content", "message", "alert_message", "body"];
      for (const k of preferKeys) {
        if (k in body && typeof body[k] === "string" && body[k].trim() !== "") {
          body = body[k];
          break;
        }
      }

      // If still an object, convert object -> multiline string by joining values
      if (typeof body === "object") {
        const values = [];
        for (const key of Object.keys(body)) {
          const v = body[key];
          if (v === null || v === undefined) continue;
          if (typeof v === "string" && v.trim() !== "") {
            values.push(v);
          } else if (typeof v === "object") {
            try {
              values.push(JSON.stringify(v));
            } catch {
              // fallback
              values.push(String(v));
            }
          } else {
            values.push(String(v));
          }
        }
        body = values.join("\n");
      }
    }

    // Ensure final body is a string
    if (body === undefined || body === null) body = "";
    body = String(body);

    // Case-insensitive check for "CISD Formed"
    if (!body.toLowerCase().includes("cisd formed")) {
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
        // Backoff and retry
        let waitMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s...
        try {
          const data = await response.json();
          if (data && data.retry_after) {
            const val = Number(data.retry_after);
            if (!Number.isNaN(val)) {
              // data.retry_after may be seconds or ms; handle both gently
              waitMs = val > 10 ? val : val * 1000;
            }
          }
        } catch (e) {
          // ignore parse error
        }
        await new Promise((r) => setTimeout(r, waitMs));
        return sendToDiscord(content, attempt + 1);
      }

      return response;
    }

    // Forward the exact alert text (preserving newlines)
    const discordResp = await sendToDiscord(body);

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
