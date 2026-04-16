import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import Transaction from "@/src/backend/models/Transaction";
import Workspace from "@/src/backend/models/Workspace";
import Wallet from "@/src/backend/models/Wallet";

const getUserId = (req: NextRequest) => req.headers.get("id");

// Helper function to handle balance adjustments on Create
async function applyTransactionToWallets(transaction: any) {
  const amount = Number(transaction.amount);

  if (transaction.type === "expense") {
    await Wallet.findByIdAndUpdate(transaction.walletId, {
      $inc: { balance: -amount },
    });
  } else if (transaction.type === "income") {
    await Wallet.findByIdAndUpdate(transaction.walletId, {
      $inc: { balance: amount },
    });
  } else if (transaction.type === "transfer") {
    await Wallet.findByIdAndUpdate(transaction.fromWalletId, {
      $inc: { balance: -amount },
    });
    await Wallet.findByIdAndUpdate(transaction.toWalletId, {
      $inc: { balance: amount },
    });
  }
}

// 1. CREATE transaction
export async function POST(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const body = await req.json();
    const { workspaceId, type, amount } = body;

    if (!workspaceId)
      return errorResponse(null, 400, "Workspace ID is required");
    if (!type || amount === undefined)
      return errorResponse(null, 400, "Type and amount are required");

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

    const newTransaction = await Transaction.create({
      ...body,
      workspaceId,
      userId,
    });

    // Update Wallet Balance
    await applyTransactionToWallets(newTransaction);

    return successResponse(
      newTransaction,
      201,
      "Transaction created successfully",
    );
  } catch (error: any) {
    return errorResponse(
      null,
      500,
      error.message || "Failed to create transaction",
    );
  }
}

// 2. GET transactions by workspaceId
export async function GET(req: NextRequest) {
  try {
    await connectMongoDB();

    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    // Find the user's default workspace
    const workspace = await Workspace.findOne({
      ownerId: userId,
      isDefault: true,
    });

    if (!workspace)
      return errorResponse(
        null,
        403,
        "Forbidden: Workspace not found or you don't have access",
      );

    const workspaceId = workspace._id.toString();

    // Build query
    const url = new URL(req.url);
    const query: any = { workspaceId, userId };

    // Optional filtering
    const type = url.searchParams.get("type");
    if (type) query.type = type;

    const walletId = url.searchParams.get("walletId");
    if (walletId) {
      query.$or = [
        { walletId },
        { fromWalletId: walletId },
        { toWalletId: walletId },
      ];
    }

    const categoryId = url.searchParams.get("categoryId");
    if (categoryId) query.categoryId = categoryId;

    // Optional date range filtering
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1, createdAt: -1 })
      .populate("walletId categoryId fromWalletId toWalletId");

    return successResponse(
      transactions,
      200,
      "Transactions fetched successfully",
    );
  } catch (error: any) {
    return errorResponse(
      null,
      500,
      error.message || "Failed to fetch transactions",
    );
  }
}
