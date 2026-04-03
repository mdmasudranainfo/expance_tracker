import { connectMongoDB } from "@/src/backend/lib/mongodb"
import User from "@/src/backend/models/User"
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcrypt"

export const POST = async (req: NextRequest) => {
    try {
        await connectMongoDB()

        const data = await req.json()

        console.log(data)

        // Validate required fields
        const { name, email, password, image, provider } = data

        // hasing the password 
        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALT_ROUND || "10"))
        console.log(hashedPassword)
      

        if (!name || !email) {
            return NextResponse.json(
                { error: "Name and email are required" },
                { status: 400 }
            )
        }

        // Check if user with this email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() })

        if (existingUser) {
            return NextResponse.json(
                { error: "Email already registered. Please use a different email." },
                { status: 409 }
            )
        }

        // Prepare user data with defaults
        const userData = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            image: image || "",
            provider: provider || "credentials",
            role: "user",
            defaultWorkspaceId: undefined,
        }

        // Create user
        const user = await User.create(userData)

        // Return success response without sensitive data
        return NextResponse.json(
            {
                message: "User created successfully",
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    provider: user.provider,
                    role: user.role,
                }
            },
            { status: 201 }
        )

    } catch (error: any) {
        console.error("Registration error:", error)

        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            return NextResponse.json(
                { error: "Email already exists. Please use a different email." },
                { status: 409 }
            )
        }

        // Handle validation errors
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((err: any) => err.message)
            return NextResponse.json(
                { error: messages.join(", ") },
                { status: 400 }
            )
        }

        return NextResponse.json(
            { error: "Internal server error. Please try again later." },
            { status: 500 }
        )
    }
}
