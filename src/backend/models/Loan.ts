import mongoose from "mongoose";

const loanSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["borrowed", "lent"],
      required: true,
    },
    personName: {
      type: String,
      required: true,
      trim: true,
    },
    personPhone: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    interest: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPayable: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    installmentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    frequency: {
      type: String,
      enum: ["one_time", "weekly", "monthly"],
      default: "one_time",
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "partially_paid", "overdue", "paid", "cancelled"],
      default: "active",
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
  },
  {
    timestamps: true,
  },
);

loanSchema.index({ workspaceId: 1, userId: 1 });
loanSchema.index({ status: 1 });
loanSchema.index({ dueDate: 1 });

const Loan = mongoose.models.Loan || mongoose.model("Loan", loanSchema);

export default Loan;
