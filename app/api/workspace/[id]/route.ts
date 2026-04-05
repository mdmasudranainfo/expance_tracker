import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import Workspace from "@/src/backend/models/Workspace";

const getUserId = (req: NextRequest) => req.headers.get("id");

// 1. GET single workspace by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectMongoDB();
        const userId = getUserId(req);
        if (!userId) return errorResponse(null, 401, "Unauthorized");

        const { id } = await params;
        if (!id) return errorResponse(null, 400, "Workspace ID is required");

        const workspace = await Workspace.findOne({ _id: id, ownerId: userId });
        if (!workspace) return errorResponse(null, 404, "Workspace not found");

        return successResponse(workspace, 200, "Workspace fetched successfully");
    } catch (error: any) {
        return errorResponse(null, 500, error.message || "Failed to fetch workspace");
    }
}

// 2. UPDATE workspace by ID
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectMongoDB();
        const userId = getUserId(req);
        if (!userId) return errorResponse(null, 401, "Unauthorized");

        const { id } = await params;
        if (!id) return errorResponse(null, 400, "Workspace ID is required");

        const body = await req.json();

        // Update the workspace, ensuring it belongs to the user
        const updatedWorkspace = await Workspace.findOneAndUpdate(
            { _id: id, ownerId: userId },
            { $set: body },
            { new: true, runValidators: true }
        );

        if (!updatedWorkspace) return errorResponse(null, 404, "Workspace not found");

        return successResponse(updatedWorkspace, 200, "Workspace updated successfully");
    } catch (error: any) {
        return errorResponse(null, 500, error.message || "Failed to update workspace");
    }
}

// 3. DELETE workspace by ID
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectMongoDB();
        const userId = getUserId(req);
        if (!userId) return errorResponse(null, 401, "Unauthorized");

        const { id } = await params;
        if (!id) return errorResponse(null, 400, "Workspace ID is required");

        // Delete the workspace, ensuring it belongs to the user
        const deletedWorkspace = await Workspace.findOneAndDelete({ _id: id, ownerId: userId });

        if (!deletedWorkspace) return errorResponse(null, 404, "Workspace not found");

        return successResponse(deletedWorkspace, 200, "Workspace deleted successfully");
    } catch (error: any) {
        return errorResponse(null, 500, error.message || "Failed to delete workspace");
    }
}