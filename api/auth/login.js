const { MongoClient } = require("mongodb")

const uri = "mongodb+srv://om3479781:omkumar@freelance.duui2y.mongodb.net/?appName=freelance"
const client = new MongoClient(uri)

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      })
    }

    await client.connect()
    const database = client.db("freelance")
    const users = database.collection("users")

    // Find user
    const user = await users.findOne({ email })

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      })
    }

    // Check password (in production, use bcrypt to compare hashed passwords)
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      })
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user

    return res.status(200).json({
      success: true,
      user: userWithoutPassword,
    })
  } catch (error) {
    console.error("[v0] Login error:", error)
    return res.status(500).json({
      success: false,
      error: "Login failed. Please try again.",
    })
  } finally {
    await client.close()
  }
}
