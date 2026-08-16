import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import Loan from "@/src/backend/models/Loan";
import LoanPayment from "@/src/backend/models/LoanPayment";
import Transaction from "@/src/backend/models/Transaction";
import Wallet from "@/src/backend/models/Wallet";
import Workspace from "@/src/backend/models/Workspace";
import { calculateLoanStatus } from "@/src/backend/utils/loans";
import { applyTransactionToWallets, reverseTransactionFromWallets } from "@/src/backend/utils/transactions";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";

const getUserId = (req: NextRequest) => req.headers.get("id");

async function findOwnedLoanAndPayment(id: string, paymentId: string, userId: string) {
  const loan = await Loan.findById(id);
  if (!loan) return { error: "Loan not found", status: 404 };
  const workspace = await Workspace.findOne({ _id: loan.workspaceId, ownerId: userId });
  if (!workspace) return { error: "Forbidden: You don't have access to this loan", status: 403 };
  const payment = await LoanPayment.findOne({ _id: paymentId, loanId: loan._id });
  if (!payment) return { error: "Payment not found", status: 404 };
  return { loan, payment };
}

const refreshLoanTotals = async (loan: any) => {
  const payments = await LoanPayment.find({ loanId: loan._id });
  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  loan.paidAmount = paidAmount;
  loan.remainingAmount = Math.max(Number(loan.totalPayable || 0) - paidAmount, 0);
  loan.status = calculateLoanStatus(loan.remainingAmount, loan.totalPayable, loan.dueDate, loan.status);
  await loan.save();
};

const serializeLoan = async (loan: any) => {
  const payments = await LoanPayment.find({ loanId: loan._id }).sort({ paymentDate: -1, createdAt: -1 });
  return {
    ...loan.toObject(),
    payments,
  };
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");
    const { id, paymentId } = await params;
    const { loan, payment, error, status } = await findOwnedLoanAndPayment(id, paymentId, userId);
    if (error) return errorResponse(null, status, error);

    const body = await req.json();
    const amount = body.amount === undefined ? payment.amount : Number(body.amount);
    const otherPayments = await LoanPayment.find({ loanId: loan._id, _id: { $ne: payment._id } });
    const otherPaid = otherPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse(null, 400, "Payment amount must be greater than zero");
    if (otherPaid + amount > Number(loan.totalPayable || 0)) {
      return errorResponse(null, 400, "Total payments cannot exceed loan amount");
    }

    const walletId = body.walletId || payment.walletId;
    const wallet = await Wallet.findOne({ _id: walletId, workspaceId: loan.workspaceId });
    if (!wallet) return errorResponse(null, 400, "Wallet not found in this workspace");

    const oldTransaction = payment.transactionId ? await Transaction.findById(payment.transactionId) : null;
    if (oldTransaction) await reverseTransactionFromWallets(oldTransaction);

    Object.assign(payment, {
      amount,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : payment.paymentDate,
      walletId,
      note: body.note === undefined ? payment.note : String(body.note || "").trim(),
    });
    await payment.save();

    const transactionPayload = {
      workspaceId: loan.workspaceId,
      userId,
      walletId,
      type: loan.type === "borrowed" ? "loan_payment" : "loan_received_back",
      amount,
      note: payment.note || `${loan.type === "borrowed" ? "Loan payment to" : "Loan received back from"} ${loan.personName}`,
      date: payment.paymentDate,
      loanId: loan._id,
      loanPaymentId: payment._id,
      personName: loan.personName,
    };
    const transaction = oldTransaction
      ? await Transaction.findByIdAndUpdate(oldTransaction._id, { $set: transactionPayload }, { new: true, runValidators: true })
      : await Transaction.create(transactionPayload);
    await applyTransactionToWallets(transaction);

    payment.transactionId = transaction._id;
    await payment.save();
    await refreshLoanTotals(loan);

    return successResponse({ loan: await serializeLoan(loan), payment }, 200, "Loan payment updated successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to update loan payment");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");
    const { id, paymentId } = await params;
    const { loan, payment, error, status } = await findOwnedLoanAndPayment(id, paymentId, userId);
    if (error) return errorResponse(null, status, error);

    if (payment.transactionId) {
      const transaction = await Transaction.findByIdAndDelete(payment.transactionId);
      if (transaction) await reverseTransactionFromWallets(transaction);
    }

    await LoanPayment.findByIdAndDelete(payment._id);
    await refreshLoanTotals(loan);

    return successResponse({ loan: await serializeLoan(loan), paymentId }, 200, "Loan payment deleted successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to delete loan payment");
  }
}
