import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import Task from "@/src/backend/models/Task";
import Workspace from "@/src/backend/models/Workspace";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";

const getUserId = (req: NextRequest) => req.headers.get("id");

async function findOwnedTask(id: string, userId: string) {
  const task = await Task.findById(id);
  if (!task) return { error: "Task not found", status: 404 };
  const workspace = await Workspace.findOne({ _id: task.workspaceId, ownerId: userId });
  if (!workspace) return { error: "Forbidden: You don't have access to this task", status: 403 };
  return { task };
}

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isValidTime = (value: string) => /^\d{2}:\d{2}$/.test(value);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");
    const { id } = await params;
    const { task, error, status } = await findOwnedTask(id, userId);
    if (error) return errorResponse(null, status, error);
    return successResponse(task, 200, "Task fetched successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to fetch task");
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");
    const { id } = await params;
    const { task, error, status } = await findOwnedTask(id, userId);
    if (error) return errorResponse(null, status, error);

    const body = await req.json();
    const patch: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = String(body.title || "").trim();
      if (!title) return errorResponse(null, 400, "Task title is required");
      patch.title = title;
    }
    if (body.description !== undefined) patch.description = String(body.description || "").trim();
    if (body.date !== undefined) {
      const date = String(body.date || "").trim();
      if (!isValidDate(date)) return errorResponse(null, 400, "Task date must be YYYY-MM-DD");
      patch.date = date;
    }
    if (body.time !== undefined) {
      const time = String(body.time || "").trim();
      if (!isValidTime(time)) return errorResponse(null, 400, "Task time must be HH:mm");
      patch.time = time;
    }
    if (body.priority !== undefined) {
      const priority = String(body.priority || "MEDIUM").toUpperCase();
      if (!["LOW", "MEDIUM", "HIGH"].includes(priority)) return errorResponse(null, 400, "Invalid priority");
      patch.priority = priority;
    }
    if (body.status !== undefined) {
      const nextStatus = String(body.status).toUpperCase();
      if (!["PENDING", "COMPLETED"].includes(nextStatus)) return errorResponse(null, 400, "Invalid status");
      patch.status = nextStatus;
    }
    if (body.notificationEnabled !== undefined) patch.notificationEnabled = Boolean(body.notificationEnabled);
    if (body.notificationMinutesBefore !== undefined) {
      const minutes = Number(body.notificationMinutesBefore);
      if (!Number.isFinite(minutes) || minutes < 0) return errorResponse(null, 400, "Invalid notification timing");
      patch.notificationMinutesBefore = minutes;
    }
    if (body.notificationId !== undefined) patch.notificationId = String(body.notificationId || "");

    const updated = await Task.findByIdAndUpdate(task._id, { $set: patch }, { new: true, runValidators: true });
    return successResponse(updated, 200, "Task updated successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to update task");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");
    const { id } = await params;
    const { task, error, status } = await findOwnedTask(id, userId);
    if (error) return errorResponse(null, status, error);
    await Task.findByIdAndDelete(task._id);
    return successResponse(task, 200, "Task deleted successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to delete task");
  }
}
