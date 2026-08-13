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
    const { workspaceId, type, amount, clientId } = body;

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

    if (clientId) {
      const existingTransaction = await Transaction.findOne({
        userId,
        clientId: String(clientId),
      });

      if (existingTransaction) {
        return successResponse(
          existingTransaction,
          200,
          "Transaction already synced",
        );
      }
    }

    const newTransaction = await Transaction.create({
      ...body,
      workspaceId,
      userId,
      clientId: clientId ? String(clientId) : undefined,
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

    const url = new URL(req.url);
    const query: any = { workspaceId, userId };

    // ─── Type Filter (expense | income) ───────────────────────────────
    const type = url.searchParams.get("type");
    const VALID_TYPES = ["expense", "income", "transfer"];
    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return errorResponse(
          null,
          400,
          `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
        );
      }
      query.type = type;
    }

    // ─── Wallet Filter ─────────────────────────────────────────────────
    const walletId = url.searchParams.get("walletId");
    if (walletId) {
      query.$or = [
        { walletId },
        { fromWalletId: walletId },
        { toWalletId: walletId },
      ];
    }

    // ─── Category Filter ───────────────────────────────────────────────
    const categoryParam = url.searchParams.get("categoryId");
    if (categoryParam) {
      const categoryIds = categoryParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      query.categoryId =
        categoryIds.length === 1 ? categoryIds[0] : { $in: categoryIds };
    }

    // ─── Date Range Filter ─────────────────────────────────────────────
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const toDate = new Date(endDate);
        toDate.setHours(23, 59, 59, 999);
        query.date.$lte = toDate;
      }
    }

    // ─── Pagination ────────────────────────────────────────────────────
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)),
    );
    const skip = (page - 1) * limit;

    const [transactions, totalCount] = await Promise.all([
      Transaction.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("walletId categoryId fromWalletId toWalletId"),
      Transaction.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return successResponse(
      {
        transactions,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        filters: {
          type: type || null,
          categoryId: categoryParam || null,
          walletId: walletId || null,
          start_date: startDate || null,
          end_date: endDate || null,
        },
      },
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
