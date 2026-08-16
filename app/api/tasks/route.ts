import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import Task from "@/src/backend/models/Task";
import Workspace from "@/src/backend/models/Workspace";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";

const getUserId = (req: NextRequest) => req.headers.get("id");

const getDefaultWorkspace = async (userId: string) =>
  Workspace.findOne({ ownerId: userId, isDefault: true });

const ensureWorkspaceAccess = async (workspaceId: string, userId: string) => {
  const workspace = await Workspace.findOne({ _id: workspaceId, ownerId: userId });
  if (!workspace) throw new Error("Forbidden: Workspace not found or you don't have access");
  return workspace;
};

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isValidTime = (value: string) => /^\d{2}:\d{2}$/.test(value);

export async function GET(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const url = new URL(req.url);
    const requestedWorkspaceId = url.searchParams.get("workspaceId");
    const workspace = requestedWorkspaceId
      ? await ensureWorkspaceAccess(requestedWorkspaceId, userId)
      : await getDefaultWorkspace(userId);
    if (!workspace) return errorResponse(null, 403, "Forbidden: Workspace not found or you don't have access");

    const query: any = { workspaceId: workspace._id, createdBy: userId };
    const date = url.searchParams.get("date");
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");

    if (date) query.date = date;
    if (status) query.status = status.toUpperCase();
    if (priority) query.priority = priority.toUpperCase();

    const tasks = await Task.find(query).sort({ date: 1, time: 1, priority: -1, createdAt: -1 });
    return successResponse(tasks, 200, "Tasks fetched successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to fetch tasks");
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const body = await req.json();
    const workspace = body.workspaceId
      ? await ensureWorkspaceAccess(body.workspaceId, userId)
      : await getDefaultWorkspace(userId);
    if (!workspace) return errorResponse(null, 403, "Forbidden: Workspace not found or you don't have access");

    const title = String(body.title || "").trim();
    const date = String(body.date || "").trim();
    const time = String(body.time || "").trim();
    const priority = String(body.priority || "MEDIUM").toUpperCase();

    if (!title) return errorResponse(null, 400, "Task title is required");
    if (!isValidDate(date)) return errorResponse(null, 400, "Task date must be YYYY-MM-DD");
    if (!isValidTime(time)) return errorResponse(null, 400, "Task time must be HH:mm");
    if (!["LOW", "MEDIUM", "HIGH"].includes(priority)) return errorResponse(null, 400, "Invalid priority");

    const task = await Task.create({
      workspaceId: workspace._id,
      createdBy: userId,
      title,
      description: String(body.description || "").trim(),
      date,
      time,
      priority,
      status: body.status === "COMPLETED" ? "COMPLETED" : "PENDING",
      notificationEnabled: body.notificationEnabled !== false,
      notificationMinutesBefore: Number(body.notificationMinutesBefore ?? 10),
      notificationId: String(body.notificationId || ""),
    });

    return successResponse(task, 201, "Task created successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to create task");
  }
}
