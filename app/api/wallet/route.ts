import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import Wallet from "@/src/backend/models/Wallet";
import Workspace from "@/src/backend/models/Workspace";

const getUserId = (req: NextRequest) => req.headers.get("id");

// 1. CREATE wallet
export async function POST(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const body = await req.json();
    const { workspaceId, name, type, balance, currency } = body;

    if (!workspaceId)
      return errorResponse(null, 400, "Workspace ID is required");

    // Ensure the workspace exists and belongs to the user
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      ownerId: userId,
    });
    if (!workspace)
      return errorResponse(
        null,
        403,
        "Forbidden: Workspace not found or you don't have access",
      );

    const existingWallet = await Wallet.findOne({ workspaceId, name, type });
    if (existingWallet)
      return errorResponse(null, 400, "Wallet already exists");

    const newWallet = await Wallet.create({
      workspaceId,
      name,
      type,
      balance: balance || 0,
      currency: currency || workspace.currency?.code || "USD", // fallback to workspace currency
    });

    return successResponse(newWallet, 201, "Wallet created successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to create wallet");
  }
}

// 2. GET wallets by workspaceId
export async function GET(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    //

    const workspace1 = await Workspace.findOne({
      ownerId: userId,
      isDefault: true,
    });

    const workspaceId1 = workspace1?._id.toString() || null;

    //

    // const url = new URL(req.url);
    // const workspaceId = url.searchParams.get("workspaceId");

    if (!workspaceId1)
      return errorResponse(
        null,
        400,
        "workspaceId query parameter is required",
      );

    // Ensure the workspace exists and belongs to the user
    const workspace = await Workspace.findOne({
      _id: workspaceId1,
      ownerId: userId,
    });
    if (!workspace)
      return errorResponse(
        null,
        403,
        "Forbidden: Workspace not found or you don't have access",
      );

    const wallets = await Wallet.find({ workspaceId: workspaceId1 }).sort({
      createdAt: 1,
    });

    return successResponse(wallets, 200, "Wallets fetched successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to fetch wallets");
  }
}
