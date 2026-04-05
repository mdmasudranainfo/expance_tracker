import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import Wallet from "@/src/backend/models/Wallet";
import Workspace from "@/src/backend/models/Workspace";

const getUserId = (req: NextRequest) => req.headers.get("id");

// Helper to verify user owns the wallet's workspace
async function verifyWalletOwnership(walletId: string, userId: string) {
    const wallet = await Wallet.findById(walletId);
    if (!wallet) return { error: "Wallet not found", status: 404 };

    const workspace = await Workspace.findOne({ _id: wallet.workspaceId, ownerId: userId });
    if (!workspace) return { error: "Forbidden: You don't have access to this wallet's workspace", status: 403 };

    return { wallet };
}

// 1. GET single wallet by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectMongoDB();
        const userId = getUserId(req);
        if (!userId) return errorResponse(null, 401, "Unauthorized");

        const { id } = await params;
        if (!id) return errorResponse(null, 400, "Wallet ID is required");

        const { wallet, error, status } = await verifyWalletOwnership(id, userId);
        if (error) return errorResponse(null, status, error);

        return successResponse(wallet, 200, "Wallet fetched successfully");
    } catch (error: any) {
        return errorResponse(null, 500, error.message || "Failed to fetch wallet");
    }
}

// 2. UPDATE wallet by ID
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectMongoDB();
        const userId = getUserId(req);
        if (!userId) return errorResponse(null, 401, "Unauthorized");

        const { id } = await params;
        if (!id) return errorResponse(null, 400, "Wallet ID is required");

        const { error, status } = await verifyWalletOwnership(id, userId);
        if (error) return errorResponse(null, status, error);

        const body = await req.json();

        // Update the wallet, (workspaceId should ideally not be updatable, but allowed fields are fine)
        const updatedWallet = await Wallet.findByIdAndUpdate(
            id,
            { $set: body },
            { new: true, runValidators: true }
        );

        return successResponse(updatedWallet, 200, "Wallet updated successfully");
    } catch (error: any) {
        return errorResponse(null, 500, error.message || "Failed to update wallet");
    }
}

// 3. DELETE wallet by ID
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectMongoDB();
        const userId = getUserId(req);
        if (!userId) return errorResponse(null, 401, "Unauthorized");

        const { id } = await params;
        if (!id) return errorResponse(null, 400, "Wallet ID is required");

        const { error, status } = await verifyWalletOwnership(id, userId);
        if (error) return errorResponse(null, status, error);

        const deletedWallet = await Wallet.findByIdAndDelete(id);

        return successResponse(deletedWallet, 200, "Wallet deleted successfully");
    } catch (error: any) {
        return errorResponse(null, 500, error.message || "Failed to delete wallet");
    }
}
