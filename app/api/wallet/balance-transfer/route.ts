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
      amount,
      transferFee = 0,
      note = "",
    } = body;

    // Validate required fields
    if (!workspaceId)
      return errorResponse(null, 400, "Workspace ID is required");
    if (!fromWalletId)
      return errorResponse(null, 400, "Source wallet ID is required");
    if (!toWalletId)
      return errorResponse(null, 400, "Destination wallet ID is required");
    if (!amount || amount <= 0)
      return errorResponse(null, 400, "Amount must be greater than 0");
    if (transferFee < 0)
      return errorResponse(null, 400, "Transfer fee cannot be negative");
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

    // Step 1: Deduct from source wallet
    await Wallet.findByIdAndUpdate(fromWalletId, {
      $inc: { balance: -amount - transferFee },
    });

    // Step 2: Add to destination wallet
    await Wallet.findByIdAndUpdate(toWalletId, {
      $inc: { balance: amount },
    });

    // Step 3: Find or create "transfer" category
    let transferCategory = await Category.findOne({
      workspaceId,
      name: "transfer",
    });

    if (!transferCategory) {
      transferCategory = await Category.create({
        workspaceId,
        name: "transfer",
        type: "expense",
      });
    }

    if (transferFee) {
      // Step 4: Create main transfer transaction
      await Transaction.create({
        workspaceId,
        userId,
        type: "expense",
        amount: transferFee,
        note: note || `${fromWallet.name} to ${toWallet.name}`,
        walletId: fromWalletId,
        categoryId: transferCategory._id,
        date: new Date(),
      });
    }

    // costTransaction,
    return successResponse(
      {
        totalDeducted: totalDeduction,
        totalReceived: amount,
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
