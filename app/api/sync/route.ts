import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";
import Category from "@/src/backend/models/Category";
import Transaction from "@/src/backend/models/Transaction";
import Wallet from "@/src/backend/models/Wallet";
import Workspace from "@/src/backend/models/Workspace";

type SyncAction = "create" | "update" | "delete";
type SyncEntity = "workspace" | "wallet" | "category" | "transaction";

interface SyncOperation {
  action: SyncAction;
  entity: SyncEntity;
  clientId?: string;
  localId?: string;
  serverId?: string;
  payload?: Record<string, any>;
}

const getUserId = (req: NextRequest) => req.headers.get("id");

const getResolvedId = (operation: SyncOperation, idMap: Record<string, string>) => {
  const candidates = [
    operation.serverId,
    operation.clientId,
    operation.localId,
    operation.payload?.clientId,
    operation.payload?.localId,
    operation.payload?._id,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && idMap[candidate]) {
      return idMap[candidate];
    }
  }

  return candidates[0] || null;
};

const rewriteIds = (payload: Record<string, any>, idMap: Record<string, string>) => {
  const next = { ...payload };
  for (const key of ["workspaceId", "walletId", "fromWalletId", "toWalletId", "categoryId"]) {
    const value = next[key];
    if (value && idMap[String(value)]) {
      next[key] = idMap[String(value)];
    }
  }
  return next;
};

const sanitizePayload = (payload: Record<string, any> = {}) => {
  const next = { ...payload };
  delete next._id;
  delete next.clientId;
  delete next.localId;
  delete next.serverId;
  delete next.syncStatus;
  delete next.retryCount;
  delete next.status;
  return next;
};

async function ensureWorkspaceOwnership(workspaceId: string, userId: string) {
  const workspace = await Workspace.findOne({ _id: workspaceId, ownerId: userId });
  if (!workspace) {
    throw new Error("Forbidden: Workspace not found or you don't have access");
  }
  return workspace;
}

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

async function reverseTransactionFromWallets(transaction: any) {
  const amount = Number(transaction.amount);

  if (transaction.type === "expense") {
    await Wallet.findByIdAndUpdate(transaction.walletId, {
      $inc: { balance: amount },
    });
  } else if (transaction.type === "income") {
    await Wallet.findByIdAndUpdate(transaction.walletId, {
      $inc: { balance: -amount },
    });
  } else if (transaction.type === "transfer") {
    await Wallet.findByIdAndUpdate(transaction.fromWalletId, {
      $inc: { balance: amount },
    });
    await Wallet.findByIdAndUpdate(transaction.toWalletId, {
      $inc: { balance: -amount },
    });
  }
}

async function processOperation(
  operation: SyncOperation,
  userId: string,
  idMap: Record<string, string>,
) {
  const payload = rewriteIds(sanitizePayload(operation.payload || {}), idMap);
  const localReference = operation.clientId || operation.localId || payload.clientId || payload.localId || payload._id;

  if (operation.entity === "workspace") {
    if (operation.action === "create") {
      const workspace = await Workspace.create({
        ...payload,
        ownerId: userId,
        isDefault: payload.isDefault ?? false,
        isPersonal: payload.isPersonal ?? false,
      });
      if (localReference) idMap[String(localReference)] = workspace._id.toString();
      return {
        clientId: localReference || null,
        serverId: workspace._id.toString(),
        entity: operation.entity,
        action: operation.action,
        status: "synced",
      };
    }

    const resolvedId = getResolvedId(operation, idMap);
    if (!resolvedId) throw new Error("Workspace ID is required");
    await ensureWorkspaceOwnership(resolvedId, userId);

    if (operation.action === "update") {
      const updated = await Workspace.findByIdAndUpdate(
        resolvedId,
        { $set: payload },
        { new: true, runValidators: true },
      );
      return {
        clientId: localReference || null,
        serverId: resolvedId,
        entity: operation.entity,
        action: operation.action,
        status: "synced",
        data: updated,
      };
    }

    const deleted = await Workspace.findByIdAndDelete(resolvedId);
    return {
      clientId: localReference || null,
      serverId: resolvedId,
      entity: operation.entity,
      action: operation.action,
      status: "synced",
      data: deleted,
    };
  }

  if (operation.entity === "wallet") {
    if (operation.action === "create") {
      if (!payload.workspaceId) throw new Error("Workspace ID is required");
      const workspace = await ensureWorkspaceOwnership(String(payload.workspaceId), userId);
      const wallet = await Wallet.create({
        workspaceId: payload.workspaceId,
        name: payload.name,
        type: payload.type,
        balance: payload.balance ?? 0,
        currency: payload.currency || workspace.currency?.code || "USD",
      });
      if (localReference) idMap[String(localReference)] = wallet._id.toString();
      return {
        clientId: localReference || null,
        serverId: wallet._id.toString(),
        entity: operation.entity,
        action: operation.action,
        status: "synced",
      };
    }

    const resolvedId = getResolvedId(operation, idMap);
    if (!resolvedId) throw new Error("Wallet ID is required");
    const wallet = await Wallet.findById(resolvedId);
    if (!wallet) throw new Error("Wallet not found");
    await ensureWorkspaceOwnership(String(wallet.workspaceId), userId);

    if (operation.action === "update") {
      const updated = await Wallet.findByIdAndUpdate(
        resolvedId,
        { $set: payload },
        { new: true, runValidators: true },
      );
      return {
        clientId: localReference || null,
        serverId: resolvedId,
        entity: operation.entity,
        action: operation.action,
        status: "synced",
        data: updated,
      };
    }

    const deleted = await Wallet.findByIdAndDelete(resolvedId);
    return {
      clientId: localReference || null,
      serverId: resolvedId,
      entity: operation.entity,
      action: operation.action,
      status: "synced",
      data: deleted,
    };
  }

  if (operation.entity === "category") {
    if (operation.action === "create") {
      if (!payload.workspaceId) throw new Error("Workspace ID is required");
      const workspace = await ensureWorkspaceOwnership(String(payload.workspaceId), userId);
      const existingCategory = await Category.findOne({
        workspaceId: payload.workspaceId,
        name: payload.name,
        type: payload.type,
      });
      if (existingCategory) throw new Error("Category already exists with this name and type");

      const category = await Category.create({
        workspaceId: payload.workspaceId,
        name: payload.name,
        type: payload.type,
        isDefault: payload.isDefault ?? false,
        currency: payload.currency || workspace.currency?.code || "USD",
      });
      if (localReference) idMap[String(localReference)] = category._id.toString();
      return {
        clientId: localReference || null,
        serverId: category._id.toString(),
        entity: operation.entity,
        action: operation.action,
        status: "synced",
      };
    }

    const resolvedId = getResolvedId(operation, idMap);
    if (!resolvedId) throw new Error("Category ID is required");
    const category = await Category.findById(resolvedId);
    if (!category) throw new Error("Category not found");
    await ensureWorkspaceOwnership(String(category.workspaceId), userId);

    if (operation.action === "update") {
      const updated = await Category.findByIdAndUpdate(
        resolvedId,
        { $set: payload },
        { new: true, runValidators: true },
      );
      return {
        clientId: localReference || null,
        serverId: resolvedId,
        entity: operation.entity,
        action: operation.action,
        status: "synced",
        data: updated,
      };
    }

    const deleted = await Category.findByIdAndDelete(resolvedId);
    return {
      clientId: localReference || null,
      serverId: resolvedId,
      entity: operation.entity,
      action: operation.action,
      status: "synced",
      data: deleted,
    };
  }

  if (operation.entity === "transaction") {
    if (operation.action === "create") {
      if (!payload.workspaceId) throw new Error("Workspace ID is required");
      await ensureWorkspaceOwnership(String(payload.workspaceId), userId);

      if (localReference) {
        const existingTransaction = await Transaction.findOne({
          userId,
          clientId: String(localReference),
        });

        if (existingTransaction) {
          idMap[String(localReference)] = existingTransaction._id.toString();
          return {
            clientId: localReference,
            serverId: existingTransaction._id.toString(),
            entity: operation.entity,
            action: operation.action,
            status: "synced",
            data: existingTransaction,
          };
        }
      }

      const transaction = await Transaction.create({
        ...payload,
        userId,
        clientId: localReference ? String(localReference) : undefined,
      });
      await applyTransactionToWallets(transaction);
      if (localReference) idMap[String(localReference)] = transaction._id.toString();
      return {
        clientId: localReference || null,
        serverId: transaction._id.toString(),
        entity: operation.entity,
        action: operation.action,
        status: "synced",
        data: transaction,
      };
    }

    const resolvedId = getResolvedId(operation, idMap);
    if (!resolvedId) throw new Error("Transaction ID is required");
    const oldTransaction = await Transaction.findById(resolvedId);
    if (!oldTransaction) throw new Error("Transaction not found");
    await ensureWorkspaceOwnership(String(oldTransaction.workspaceId), userId);

    if (operation.action === "update") {
      await reverseTransactionFromWallets(oldTransaction);
      const updatedTransaction = await Transaction.findByIdAndUpdate(
        resolvedId,
        { $set: payload },
        { new: true, runValidators: true },
      );
      if (!updatedTransaction) {
        await applyTransactionToWallets(oldTransaction);
        throw new Error("Transaction not found during update");
      }
      await applyTransactionToWallets(updatedTransaction);
      return {
        clientId: localReference || null,
        serverId: resolvedId,
        entity: operation.entity,
        action: operation.action,
        status: "synced",
        data: updatedTransaction,
      };
    }

    const deleted = await Transaction.findByIdAndDelete(resolvedId);
    if (deleted) {
      await reverseTransactionFromWallets(deleted);
    }
    return {
      clientId: localReference || null,
      serverId: resolvedId,
      entity: operation.entity,
      action: operation.action,
      status: "synced",
      data: deleted,
    };
  }

  throw new Error(`Unsupported sync entity: ${operation.entity}`);
}

export async function POST(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const body = await req.json();
    const operations: SyncOperation[] = Array.isArray(body?.operations) ? body.operations : [];

    if (operations.length === 0) {
      return successResponse({ results: [] }, 200, "No operations to sync");
    }

    const results: any[] = [];
    const idMap: Record<string, string> = {};

    for (const operation of operations) {
      const result = await processOperation(operation, userId, idMap);
      results.push(result);
    }

    return successResponse(
      {
        success: true,
        results,
      },
      200,
      "Sync completed successfully",
    );
  } catch (error: any) {
    return errorResponse(
      {
        success: false,
        message: error.message || "Sync failed",
      },
      500,
      error.message || "Sync failed",
    );
  }
}
