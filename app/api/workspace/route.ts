import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import Workspace from "@/src/backend/models/Workspace";
import { getCurrencyByCode, normalizeCurrency } from "@/src/backend/utils/currency";

// Helper to get user ID from headers (set by middleware)
const getUserId = (req: NextRequest) => req.headers.get("id");

// 1. CREATE workspace
export async function POST(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse({ message: "Unauthorized" }, 401);

    const body = await req.json();
    const currency = normalizeCurrency(body.currency || getCurrencyByCode(body.currencyCode));

    const newWorkspace = await Workspace.create({
      ...body,
      currency,
      isDefault: false,
      isPersonal: false,
      ownerId: userId,
    });

    return successResponse(
      { workspace: newWorkspace },
      201,
      "Workspace created successfully",
    );
  } catch (error: any) {
    return errorResponse(
      { message: error.message || "Failed to create workspace" },
      500,
    );
  }
}

// 2. GET user workspaces
export async function GET(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse({ message: "Unauthorized" }, 401);

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("id");

    // If ID is provided, fetch a specific workspace for the user
    if (workspaceId) {
      const workspace = await Workspace.findOne({
        _id: workspaceId,
        ownerId: userId,
      });
      if (!workspace)
        return errorResponse({ message: "Workspace not found" }, 404);
      return successResponse({
        ...workspace.toObject(),
        currency: normalizeCurrency(workspace.currency),
      });
    }

    // Else fetch all workspaces for the user
    const workspaces = await Workspace.find({ ownerId: userId }).sort({
      createdAt: -1,
    });
    return successResponse(
      workspaces.map((workspace) => ({
        ...workspace.toObject(),
        currency: normalizeCurrency(workspace.currency),
      })),
    );
  } catch (error: any) {
    return errorResponse(
      { message: error.message || "Failed to fetch workspaces" },
      500,
    );
  }
}
