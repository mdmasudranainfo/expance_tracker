import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import Workspace from "@/src/backend/models/Workspace";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import { getCurrencyByCode, normalizeCurrency } from "@/src/backend/utils/currency";

const getUserId = (req: NextRequest) => req.headers.get("id");

export async function PATCH(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const { currencyCode } = await req.json();
    if (!currencyCode) {
      return errorResponse(null, 400, "currencyCode is required");
    }

    const currency = getCurrencyByCode(currencyCode);

    const updatedWorkspace = await Workspace.findOneAndUpdate(
      { ownerId: userId, isDefault: true },
      { $set: { currency } },
      { new: true, runValidators: true },
    );

    if (!updatedWorkspace) {
      return errorResponse(null, 404, "Current workspace not found");
    }

    return successResponse({
      currency: normalizeCurrency(updatedWorkspace.currency),
      workspace: {
        ...updatedWorkspace.toObject(),
        currency: normalizeCurrency(updatedWorkspace.currency),
      },
    });
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to update currency");
  }
}
