import { NextRequest } from "next/server"

import User from "@/src/backend/models/User"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { NextResponse } from "next/server"
import { connectMongoDB } from "@/src/backend/lib/mongodb"
import { errorResponse, successResponse } from "@/src/backend/utils/Response"

import { cookies } from "next/headers"

export const POST = async (req: NextRequest) => {
    try {
        await connectMongoDB()

        const { email, password } = await req.json()
        const user = await User.findOne({ email }).select("+password")
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
        const isPasswordMatch = await bcrypt.compare(password, user.password)
        if (!isPasswordMatch) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "", { expiresIn: "1d" })
        
        // 1. Set the cookie using cookies() from next/headers
        const cookieStore = await cookies();
        cookieStore.set("auth_token", token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === "production", 
            maxAge: 86400, // 1 day in seconds
            path: "/" 
        });

        return successResponse({
            auth_token: token,
            user,
        })
    } catch (error) {
        if (error instanceof Error) {
            return errorResponse({ message: error.message }, 500);
        }
        return errorResponse({ message: "Unknown error occurred" }, 500);
    }
}
