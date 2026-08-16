import mongoose from "mongoose";

const loanPaymentSchema = new mongoose.Schema(
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
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    note: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

loanPaymentSchema.index({ loanId: 1 });
loanPaymentSchema.index({ workspaceId: 1, userId: 1 });

const LoanPayment = mongoose.models.LoanPayment || mongoose.model("LoanPayment", loanPaymentSchema);

export default LoanPayment;
