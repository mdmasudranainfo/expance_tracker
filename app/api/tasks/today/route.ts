import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import Task from "@/src/backend/models/Task";
import Workspace from "@/src/backend/models/Workspace";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";

const getUserId = (req: NextRequest) => req.headers.get("id");

export async function GET(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const url = new URL(req.url);
    const today = url.searchParams.get("date");
    if (!today) return errorResponse(null, 400, "Local date is required");

    const workspace = await Workspace.findOne({ ownerId: userId, isDefault: true });
    if (!workspace) return errorResponse(null, 403, "Forbidden: Workspace not found or you don't have access");

    const tasks = await Task.find({
      workspaceId: workspace._id,
      createdBy: userId,
      date: today,
    }).sort({ time: 1, priority: -1, createdAt: -1 });

    return successResponse(tasks, 200, "Today's tasks fetched successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to fetch today's tasks");
  }
}
