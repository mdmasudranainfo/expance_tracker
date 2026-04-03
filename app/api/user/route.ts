import { connectMongoDB } from "@/src/backend/lib/mongodb"
import { NextResponse } from "next/server"


export const GET = async (req: Request, res: Response) => {
    await connectMongoDB()
    return NextResponse.json({ message: "User created successfully" }, { status: 201 })


}
