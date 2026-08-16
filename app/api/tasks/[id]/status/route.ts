import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import Task from "@/src/backend/models/Task";
import Workspace from "@/src/backend/models/Workspace";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";

const getUserId = (req: NextRequest) => req.headers.get("id");

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const { id } = await params;
    const task = await Task.findById(id);
    if (!task) return errorResponse(null, 404, "Task not found");

    const workspace = await Workspace.findOne({ _id: task.workspaceId, ownerId: userId });
    if (!workspace) return errorResponse(null, 403, "Forbidden: You don't have access to this task");

    const body = await req.json();
    const status = String(body.status || "COMPLETED").toUpperCase();
    if (!["PENDING", "COMPLETED"].includes(status)) return errorResponse(null, 400, "Invalid status");

    task.status = status;
    if (status === "COMPLETED") {
      task.notificationId = "";
    } else if (body.notificationId !== undefined) {
      task.notificationId = String(body.notificationId || "");
    }
    await task.save();

    return successResponse(task, 200, "Task status updated successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to update task status");
  }
}
