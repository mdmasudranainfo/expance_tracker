import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import Transaction from "@/src/backend/models/Transaction";
import Workspace from "@/src/backend/models/Workspace";
import Wallet from "@/src/backend/models/Wallet";

const getUserId = (req: NextRequest) => req.headers.get("id");

// Helper to verify user owns the transaction's workspace
async function verifyTransactionOwnership(transactionId: string, userId: string) {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return { error: "Transaction not found", status: 404 };

    const workspace = await Workspace.findOne({ _id: transaction.workspaceId, ownerId: userId });
    if (!workspace) return { error: "Forbidden: You don't have access to this transaction's workspace", status: 403 };

    return { transaction };
}

// Internal Helper function to reverse old balance adjustments
async function reverseTransactionFromWallets(transaction: any) {
    const amount = Number(transaction.amount);
    
    if (transaction.type === "expense") {
        await Wallet.findByIdAndUpdate(transaction.walletId, { $inc: { balance: amount } });
    } else if (transaction.type === "income") {
        await Wallet.findByIdAndUpdate(transaction.walletId, { $inc: { balance: -amount } });
    } else if (transaction.type === "transfer") {
        await Wallet.findByIdAndUpdate(transaction.fromWalletId, { $inc: { balance: amount } });
        await Wallet.findByIdAndUpdate(transaction.toWalletId, { $inc: { balance: -amount } });
    }
}

// Internal Helper function to apply new balance adjustments
async function applyTransactionToWallets(transaction: any) {
    const amount = Number(transaction.amount);
    
    if (transaction.type === "expense") {
        await Wallet.findByIdAndUpdate(transaction.walletId, { $inc: { balance: -amount } });
    } else if (transaction.type === "income") {
        await Wallet.findByIdAndUpdate(transaction.walletId, { $inc: { balance: amount } });
    } else if (transaction.type === "transfer") {
        await Wallet.findByIdAndUpdate(transaction.fromWalletId, { $inc: { balance: -amount } });
        await Wallet.findByIdAndUpdate(transaction.toWalletId, { $inc: { balance: amount } });
    }
}

// 1. GET single transaction by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectMongoDB();
        const userId = getUserId(req);
        if (!userId) return errorResponse(null, 401, "Unauthorized");

        const { id } = await params;
        if (!id) return errorResponse(null, 400, "Transaction ID is required");

        const { transaction, error, status } = await verifyTransactionOwnership(id, userId);
        if (error) return errorResponse(null, status, error);

        await transaction.populate("walletId categoryId fromWalletId toWalletId");

        return successResponse(transaction, 200, "Transaction fetched successfully");
    } catch (error: any) {
        return errorResponse(null, 500, error.message || "Failed to fetch transaction");
    }
}

// 2. UPDATE transaction by ID
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectMongoDB();
        const userId = getUserId(req);
        if (!userId) return errorResponse(null, 401, "Unauthorized");

        const { id } = await params;
        if (!id) return errorResponse(null, 400, "Transaction ID is required");

        const { transaction: oldTransaction, error, status } = await verifyTransactionOwnership(id, userId);
        if (error) return errorResponse(null, status, error);

        const body = await req.json();

        // 1. Recover the original balances from wallets before the update
        await reverseTransactionFromWallets(oldTransaction);

        // 2. Safely apply the update to the transaction model in the database
        const updatedTransaction = await Transaction.findByIdAndUpdate(
            id,
            { $set: body },
            { new: true, runValidators: true }
        );

        if (!updatedTransaction) {
            // Failsafe: re-apply the old transaction to wallets if update fails mid-way
            await applyTransactionToWallets(oldTransaction);
            return errorResponse(null, 404, "Transaction not found during update");
        }

        // 3. Deduct/Adjust the new balances using the updated values
        await applyTransactionToWallets(updatedTransaction);

        return successResponse(updatedTransaction, 200, "Transaction updated successfully");
    } catch (error: any) {
        return errorResponse(null, 500, error.message || "Failed to update transaction");
    }
}

// 3. DELETE transaction by ID
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectMongoDB();
        const userId = getUserId(req);
        if (!userId) return errorResponse(null, 401, "Unauthorized");

        const { id } = await params;
        if (!id) return errorResponse(null, 400, "Transaction ID is required");

        const { transaction, error, status } = await verifyTransactionOwnership(id, userId);
        if (error) return errorResponse(null, status, error);

        // Delete the transaction
        const deletedTransaction = await Transaction.findByIdAndDelete(id);

        if (deletedTransaction) {
            // Reverse its effect on Wallet properly
            await reverseTransactionFromWallets(deletedTransaction);
        }

        return successResponse(deletedTransaction, 200, "Transaction deleted successfully");
    } catch (error: any) {
        return errorResponse(null, 500, error.message || "Failed to delete transaction");
    }
}
