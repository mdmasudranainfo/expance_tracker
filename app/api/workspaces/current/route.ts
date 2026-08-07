import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import Workspace from "@/src/backend/models/Workspace";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import { normalizeCurrency } from "@/src/backend/utils/currency";

const getUserId = (req: NextRequest) => req.headers.get("id");

export async function GET(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const workspace = await Workspace.findOne({
      ownerId: userId,
      isDefault: true,
    });

    if (!workspace) {
      return errorResponse(null, 404, "Current workspace not found");
    }

    return successResponse({
      ...workspace.toObject(),
      currency: normalizeCurrency(workspace.currency),
    });
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to fetch current workspace");
  }
}
