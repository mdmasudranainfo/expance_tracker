import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import Category from "@/src/backend/models/Category";
import Workspace from "@/src/backend/models/Workspace";
import { Transaction } from "@/src/backend/models";

const getUserId = (req: NextRequest) => req.headers.get("id");

// Helper to verify user owns the category's workspace
async function verifyCategoryOwnership(categoryId: string, userId: string) {
  const category = await Category.findById(categoryId);
  if (!category) return { error: "Category not found", status: 404 };

  const workspace = await Workspace.findOne({
    _id: category.workspaceId,
    ownerId: userId,
  });
  if (!workspace)
    return {
      error: "Forbidden: You don't have access to this category's workspace",
      status: 403,
    };

  return { category };
}

// 1. GET single category by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const { id } = await params;
    if (!id) return errorResponse(null, 400, "Category ID is required");

    const { category, error, status } = await verifyCategoryOwnership(
      id,
      userId,
    );
    if (error) return errorResponse(null, status, error);

    return successResponse(category, 200, "Category fetched successfully");
  } catch (error: any) {
    return errorResponse(
      null,
      500,
      error.message || "Failed to fetch category",
    );
  }
}

// 2. UPDATE category by ID
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const { id } = await params;
    if (!id) return errorResponse(null, 400, "Category ID is required");

    const { category, error, status } = await verifyCategoryOwnership(
      id,
      userId,
    );
    if (error) return errorResponse(null, status, error);

    const body = await req.json();

    // Optional duplicate check if renaming
    if (body.name || body.type) {
      const newName = body.name || category.name;
      const newType = body.type || category.type;
      const existingCategory = await Category.findOne({
        workspaceId: category.workspaceId,
        name: newName,
        type: newType,
        _id: { $ne: id },
      });
      if (existingCategory) {
        return errorResponse(
          null,
          400,
          "Category already exists with this name and type",
        );
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true },
    );

    return successResponse(
      updatedCategory,
      200,
      "Category updated successfully",
    );
  } catch (error: any) {
    return errorResponse(
      null,
      500,
      error.message || "Failed to update category",
    );
  }
}

// 3. DELETE category by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const { id } = await params;
    if (!id) return errorResponse(null, 400, "Category ID is required");

    const { error, status } = await verifyCategoryOwnership(id, userId);
    if (error) return errorResponse(null, status, error);

    const transactions = await Transaction.find({ categoryId: id });
    if (transactions.length > 0) {
      return errorResponse(
        null,
        400,
        "Cannot delete category with associated transactions",
      );
    }

    const deletedCategory = await Category.findByIdAndDelete(id);

    return successResponse(
      deletedCategory,
      200,
      "Category deleted successfully",
    );
  } catch (error: any) {
    return errorResponse(
      null,
      500,
      error.message || "Failed to delete category",
    );
  }
}
