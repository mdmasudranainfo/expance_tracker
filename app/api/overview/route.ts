import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import Transaction from "@/src/backend/models/Transaction";
import Workspace from "@/src/backend/models/Workspace";

const getUserId = (req: NextRequest) => req.headers.get("id");

// Helper function to get current month date range
const getCurrentMonthDateRange = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
};

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

    const workspaceId = workspace._id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const url = new URL(req.url);

    // Default to current month
    const { startDate, endDate } = getCurrentMonthDateRange();

    // Allow custom date range
    const customStartDate = url.searchParams.get("start_date");
    const customEndDate = url.searchParams.get("end_date");

    const queryStartDate = customStartDate
      ? new Date(customStartDate)
      : startDate;
    const queryEndDate = customEndDate ? new Date(customEndDate) : endDate;
    if (customEndDate) {
      queryEndDate.setHours(23, 59, 59, 999);
    }

    const matchStage = {
      $match: {
        workspaceId: workspaceId,
        userId: userObjectId,
        type: { $in: ["expense", "income"] },
        date: {
          $gte: queryStartDate,
          $lte: queryEndDate,
        },
      },
    };

    // Fetch aggregated data using MongoDB pipeline
    const [totalStats, categoryWiseCost, categoryWiseIncome] =
      await Promise.all([
        // Get total cost and income
        Transaction.aggregate([
          matchStage,
          {
            $group: {
              _id: null,
              totalCost: {
                $sum: {
                  $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0],
                },
              },
              totalIncome: {
                $sum: {
                  $cond: [{ $eq: ["$type", "income"] }, "$amount", 0],
                },
              },
              transactionCount: { $sum: 1 },
            },
          },
        ]),
        // Get top 5 categories by expense
        Transaction.aggregate([
          {
            $match: {
              workspaceId: workspaceId,
              userId: userObjectId,
              type: "expense",
              date: {
                $gte: queryStartDate,
                $lte: queryEndDate,
              },
            },
          },
          {
            $group: {
              _id: "$categoryId",
              totalAmount: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { totalAmount: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: "categories",
              localField: "_id",
              foreignField: "_id",
              as: "category",
            },
          },
          { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              categoryName: "$category.name",
              totalAmount: 1,
              count: 1,
            },
          },
        ]),
        // Get top 5 categories by income
        Transaction.aggregate([
          {
            $match: {
              workspaceId: workspaceId,
              userId: userObjectId,
              type: "income",
              date: {
                $gte: queryStartDate,
                $lte: queryEndDate,
              },
            },
          },
          {
            $group: {
              _id: "$categoryId",
              totalAmount: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { totalAmount: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: "categories",
              localField: "_id",
              foreignField: "_id",
              as: "category",
            },
          },
          { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              categoryName: "$category.name",
              totalAmount: 1,
              count: 1,
            },
          },
        ]),
      ]);

    const stats = totalStats[0] || {
      totalCost: 0,
      totalIncome: 0,
      transactionCount: 0,
    };

    const overview = {
      summary: {
        totalCost: stats.totalCost,
        totalIncome: stats.totalIncome,
        netAmount: stats.totalIncome - stats.totalCost,
        transactionCount: stats.transactionCount,
      },
      dateRange: {
        startDate: queryStartDate,
        endDate: queryEndDate,
      },
      categoryWiseCost: categoryWiseCost.map((item) => ({
        categoryId: item._id,
        categoryName: item.categoryName || "Uncategorized",
        totalAmount: item.totalAmount,
        count: item.count,
      })),
      categoryWiseIncome: categoryWiseIncome.map((item) => ({
        categoryId: item._id,
        categoryName: item.categoryName || "Uncategorized",
        totalAmount: item.totalAmount,
        count: item.count,
      })),
    };

    return successResponse(overview, 200, "Overview fetched successfully");
  } catch (error: any) {
    return errorResponse(
      null,
      500,
      error.message || "Failed to fetch overview",
    );
  }
}
