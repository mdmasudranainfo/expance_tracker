import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: function() {
        return this.type !== "transfer";
      },
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: function() {
        return this.type !== "transfer";
      },
    },
    type: {
      type: String,
      enum: ["expense", "income", "transfer"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      default: "",
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    receiptUrl: {
      type: String,
      default: "",
    },
    clientId: {
      type: String,
    },
    // Transfer support
    fromWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
    },
    toWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
transactionSchema.index({ workspaceId: 1, userId: 1 });
transactionSchema.index({ walletId: 1 });
transactionSchema.index({ categoryId: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ date: 1 });
transactionSchema.index(
  { userId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $exists: true, $type: "string" } } },
);

const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);

export default Transaction;
