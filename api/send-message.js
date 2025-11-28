export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { name, email, subject, message } = req.body

  // Validate input
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "All fields are required" })
  }

  // Telegram Bot credentials
  const TELEGRAM_BOT_TOKEN = "7654029423:AAFS4Lu1PyaoOnP3475HNZbUT1SpBMhvE4E"
  const TELEGRAM_CHAT_ID = "2001901489"

  // Format the message for Telegram
  const telegramMessage = `
📧 New Contact Form Submission

👤 Name: ${name}
📨 Email: ${email}
📝 Subject: ${subject}

💬 Message:
${message}

---
Sent from Shrajal's Portfolio
    `.trim()

  try {
    // Send message to Telegram
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: telegramMessage,
        parse_mode: "HTML",
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Telegram API error:", data)
      return res.status(500).json({ error: "Failed to send message" })
    }

    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
    })
  } catch (error) {
    console.error("Error sending message:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}
