import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import Category from "@/src/backend/models/Category";
import Workspace from "@/src/backend/models/Workspace";

const getUserId = (req: NextRequest) => req.headers.get("id");

// 1. CREATE category
export async function POST(req: NextRequest) {
    try {
        await connectMongoDB();
        const userId = getUserId(req);
        if (!userId) return errorResponse(null, 401, "Unauthorized");

        const body = await req.json();
        const { workspaceId, name, type, isDefault } = body;

        if (!workspaceId) return errorResponse(null, 400, "Workspace ID is required");
        if (!name || !type) return errorResponse(null, 400, "Name and type are required");

        // Ensure the workspace exists and belongs to the user
        const workspace = await Workspace.findOne({ _id: workspaceId, ownerId: userId });
        if (!workspace) return errorResponse(null, 403, "Forbidden: Workspace not found or you don't have access");

        // Check if category already exists
        const existingCategory = await Category.findOne({ workspaceId, name, type });
        if (existingCategory) return errorResponse(null, 400, "Category already exists with this name and type");

        const newCategory = await Category.create({
            workspaceId,
            name,
            type,
            isDefault: isDefault || false
        });

        return successResponse(newCategory, 201, "Category created successfully");
    } catch (error: any) {
        return errorResponse(null, 500, error.message || "Failed to create category");
    }
}

// 2. GET categories by workspaceId
export async function GET(req: NextRequest) {
    try {
        await connectMongoDB();
        const userId = getUserId(req);
        if (!userId) return errorResponse(null, 401, "Unauthorized");

        const url = new URL(req.url);
        const workspaceId = url.searchParams.get("workspaceId");
        const type = url.searchParams.get("type"); // Optional filter by type (expense/income)

        if (!workspaceId) return errorResponse(null, 400, "workspaceId query parameter is required");

        // Ensure the workspace exists and belongs to the user
        const workspace = await Workspace.findOne({ _id: workspaceId, ownerId: userId });
        if (!workspace) return errorResponse(null, 403, "Forbidden: Workspace not found or you don't have access");

        const query: any = { workspaceId };
        if (type) query.type = type;

        const categories = await Category.find(query).sort({ createdAt: -1 });

        return successResponse(categories, 200, "Categories fetched successfully");
    } catch (error: any) {
        return errorResponse(null, 500, error.message || "Failed to fetch categories");
    }
}
