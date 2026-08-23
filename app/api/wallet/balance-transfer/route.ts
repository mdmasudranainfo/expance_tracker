import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import Transaction from "@/src/backend/models/Transaction";
import Wallet from "@/src/backend/models/Wallet";
import Workspace from "@/src/backend/models/Workspace";
import Category from "@/src/backend/models/Category";

const getUserId = (req: NextRequest) => req.headers.get("id");

/**
 * POST: Transfer balance between wallets
 * Request body: {
 *   workspaceId: string,
 *   fromWalletId: string,
 *   toWalletId: string,
 *   amount: number,
 *   transferFee?: number (optional),
 *   note?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const body = await req.json();
    const {
      workspaceId,
      fromWalletId,
      toWalletId,
      amount: rawAmount,
      transferFee: feeInput,
      transferCharge: chargeInput,
      note = "",
    } = body;

    const amount = Number(rawAmount);
    const transferFee = Number(chargeInput ?? feeInput ?? 0);

    // Validate required fields
    if (!workspaceId)
      return errorResponse(null, 400, "Workspace ID is required");
    if (!fromWalletId)
      return errorResponse(null, 400, "Source wallet ID is required");
    if (!toWalletId)
      return errorResponse(null, 400, "Destination wallet ID is required");
    if (isNaN(amount) || amount <= 0)
      return errorResponse(null, 400, "Amount must be greater than 0");
    if (isNaN(transferFee) || transferFee < 0)
      return errorResponse(null, 400, "Transfer charge cannot be negative");
    if (fromWalletId === toWalletId)
      return errorResponse(null, 400, "Cannot transfer to the same wallet");

    // Verify workspace exists and belongs to user
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

    // Verify both wallets exist and belong to the workspace
    const fromWallet = await Wallet.findOne({
      _id: fromWalletId,
      workspaceId,
    });
    if (!fromWallet) return errorResponse(null, 404, "Source wallet not found");

    const toWallet = await Wallet.findOne({
      _id: toWalletId,
      workspaceId,
    });
    if (!toWallet)
      return errorResponse(null, 404, "Destination wallet not found");

    // Check if source wallet has sufficient balance (amount + fee)
    const totalDeduction = amount + transferFee;
    if (fromWallet.balance < totalDeduction)
      return errorResponse(
        null,
        400,
        `Insufficient balance. Available: ${fromWallet.balance}, Required: ${totalDeduction}`,
      );

    // Step 1: Deduct from source wallet (transferred amount + transfer charge)
    await Wallet.findByIdAndUpdate(fromWalletId, {
      $inc: { balance: -amount - transferFee },
    });

    // Step 2: Add to destination wallet (only transferred amount)
    await Wallet.findByIdAndUpdate(toWalletId, {
      $inc: { balance: amount },
    });

    // Step 3: Create main transfer transaction record
    const transferTransaction = await Transaction.create({
      workspaceId,
      userId,
      type: "transfer",
      amount,
      fromWalletId,
      toWalletId,
      note: note || `${fromWallet.name} to ${toWallet.name}`,
      date: new Date(),
    });

    // Step 4: Find or create "Transfer Charge" category if fee exists
    let chargeTransaction = null;
    if (transferFee > 0) {
      let transferCategory = await Category.findOne({
        workspaceId,
        name: { $regex: /^(transfer charge|transfer fee|transfer)$/i },
        type: "expense",
      });

      if (!transferCategory) {
        transferCategory = await Category.create({
          workspaceId,
          name: "Transfer Charge",
          type: "expense",
        });
      }

      const chargeNote = note
        ? `Transfer Charge: ${note}`
        : `Transfer charge (${fromWallet.name} to ${toWallet.name})`;

      chargeTransaction = await Transaction.create({
        workspaceId,
        userId,
        type: "expense",
        amount: transferFee,
        note: chargeNote,
        walletId: fromWalletId,
        categoryId: transferCategory._id,
        date: new Date(),
      });
    }

    return successResponse(
      {
        totalDeducted: totalDeduction,
        totalReceived: amount,
        transferCharge: transferFee,
        transfer: transferTransaction,
        chargeTransaction: chargeTransaction,
      },
      201,
      "Balance transfer completed successfully",
    );
  } catch (error: any) {
    return errorResponse(
      null,
      500,
      error.message || "Failed to transfer balance",
    );
  }
}

/**
 * GET: Fetch balance transfer records
 */
export async function GET(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");

    let targetWorkspaceId = workspaceId;
    if (!targetWorkspaceId) {
      const defaultWorkspace = await Workspace.findOne({
        ownerId: userId,
        isDefault: true,
      });
      if (defaultWorkspace) {
        targetWorkspaceId = defaultWorkspace._id.toString();
      }
    }

    const query: any = {
      userId,
      type: "transfer",
    };
    if (targetWorkspaceId) {
      query.workspaceId = targetWorkspaceId;
    }

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)),
    );
    const skip = (page - 1) * limit;

    const [transfers, totalCount] = await Promise.all([
      Transaction.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("fromWalletId toWalletId"),
      Transaction.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return successResponse(
      {
        transfers,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      200,
      "Balance transfers fetched successfully",
    );
  } catch (error: any) {
    return errorResponse(
      null,
      500,
      error.message || "Failed to fetch balance transfers",
    );
  }
}
