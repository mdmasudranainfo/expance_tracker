import { Workspace } from "@/src/backend/models";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { normalizeCurrency } from "@/src/backend/utils/currency";

const getUserId = (req: NextRequest) => req.headers.get("id");

export async function POST(req: NextRequest) {
  try {
    await connectMongoDB();

    const userId = getUserId(req);
    const { workspaceId } = await req.json(); // selected workspace

    if (!userId) {
      return errorResponse({ message: "User ID not found" }, 400);
    }

    // ✅ Step 1: all workspaces → isDefault false
    await Workspace.updateMany(
      { ownerId: new mongoose.Types.ObjectId(userId) },
      { $set: { isDefault: false } },
    );

    // ✅ Step 2: selected workspace → isDefault true
    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      workspaceId,
      { $set: { isDefault: true } },
      { new: true },
    );

    return successResponse(
      {
        workspace: {
          ...updatedWorkspace?.toObject(),
          currency: normalizeCurrency(updatedWorkspace?.currency),
        },
      },
      200,
      "Workspace switched successfully",
    );
  } catch (error: any) {
    return errorResponse(
      { message: error.message || "Failed to switch workspace" },
      500,
    );
  }
}
