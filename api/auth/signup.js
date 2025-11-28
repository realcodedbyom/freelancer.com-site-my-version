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
    const { email, password, name, userType } = req.body

    if (!email || !password || !name || !userType) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      })
    }

    await client.connect()
    const database = client.db("freelance")
    const users = database.collection("users")

    // Check if user already exists
    const existingUser = await users.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User already exists",
      })
    }

    // Create new user
    const newUser = {
      email,
      password, // In production, hash this password!
      name,
      userType,
      createdAt: new Date(),
      profile:
        userType === "freelancer"
          ? {
              skills: [],
              hourlyRate: 0,
              bio: "",
              rating: 0,
              reviewCount: 0,
            }
          : {},
    }

    const result = await users.insertOne(newUser)

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser
    userWithoutPassword._id = result.insertedId

    return res.status(200).json({
      success: true,
      user: userWithoutPassword,
    })
  } catch (error) {
    console.error("[v0] Signup error:", error)
    return res.status(500).json({
      success: false,
      error: "Signup failed. Please try again.",
    })
  } finally {
    await client.close()
  }
}
