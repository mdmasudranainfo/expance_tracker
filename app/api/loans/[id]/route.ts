import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import Loan from "@/src/backend/models/Loan";
import LoanPayment from "@/src/backend/models/LoanPayment";
import Transaction from "@/src/backend/models/Transaction";
import Wallet from "@/src/backend/models/Wallet";
import Workspace from "@/src/backend/models/Workspace";
import { calculateLoanStatus, normalizeLoanTotals } from "@/src/backend/utils/loans";
import { applyTransactionToWallets, reverseTransactionFromWallets } from "@/src/backend/utils/transactions";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";

const getUserId = (req: NextRequest) => req.headers.get("id");

async function findOwnedLoan(id: string, userId: string) {
  const loan = await Loan.findById(id);
  if (!loan) return { error: "Loan not found", status: 404 };
  const workspace = await Workspace.findOne({ _id: loan.workspaceId, ownerId: userId });
  if (!workspace) return { error: "Forbidden: You don't have access to this loan", status: 403 };
  return { loan, workspace };
}

const serializeLoan = async (loan: any) => {
  const payments = await LoanPayment.find({ loanId: loan._id }).sort({ paymentDate: -1, createdAt: -1 });
  await loan.populate("walletId transactionId");
  return {
    ...loan.toObject(),
    payments,
  };
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");
    const { id } = await params;
    const { loan, error, status } = await findOwnedLoan(id, userId);
    if (error) return errorResponse(null, status, error);
    return successResponse(await serializeLoan(loan), 200, "Loan fetched successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to fetch loan");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");
    const { id } = await params;
    const { loan, error, status } = await findOwnedLoan(id, userId);
    if (error) return errorResponse(null, status, error);

    const body = await req.json();
    const payments = await LoanPayment.find({ loanId: loan._id });
    const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const amount = body.amount === undefined ? loan.amount : Number(body.amount);
    const interest = body.interest === undefined ? loan.interest : Number(body.interest);
    const totals = normalizeLoanTotals(amount, interest, paidAmount);
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse(null, 400, "Amount must be greater than zero");
    if (paidAmount > totals.totalPayable) return errorResponse(null, 400, "Loan amount cannot be less than payments already recorded");

    const walletId = body.walletId || loan.walletId;
    const wallet = await Wallet.findOne({ _id: walletId, workspaceId: loan.workspaceId });
    if (!wallet) return errorResponse(null, 400, "Wallet not found in this workspace");

    const oldTransaction = loan.transactionId ? await Transaction.findById(loan.transactionId) : null;
    if (oldTransaction) await reverseTransactionFromWallets(oldTransaction);

    Object.assign(loan, {
      type: body.type || loan.type,
      personName: body.personName === undefined ? loan.personName : String(body.personName).trim(),
      personPhone: body.personPhone === undefined ? loan.personPhone : String(body.personPhone || "").trim(),
      amount,
      interest,
      ...totals,
      startDate: body.startDate ? new Date(body.startDate) : loan.startDate,
      dueDate: body.dueDate ? new Date(body.dueDate) : loan.dueDate,
      installmentAmount: body.installmentAmount === undefined ? loan.installmentAmount : Number(body.installmentAmount || 0),
      frequency: body.frequency || loan.frequency,
      walletId,
      note: body.note === undefined ? loan.note : String(body.note || "").trim(),
    });
    loan.status = calculateLoanStatus(loan.remainingAmount, loan.totalPayable, loan.dueDate, body.status || loan.status);
    await loan.save();

    const transactionPayload = {
      workspaceId: loan.workspaceId,
      userId,
      walletId,
      type: loan.type === "borrowed" ? "loan_received" : "loan_given",
      amount: loan.amount,
      note: loan.note || `${loan.type === "borrowed" ? "Borrowed from" : "Lent to"} ${loan.personName}`,
      date: loan.startDate,
      loanId: loan._id,
      personName: loan.personName,
    };
    const transaction = oldTransaction
      ? await Transaction.findByIdAndUpdate(oldTransaction._id, { $set: transactionPayload }, { new: true, runValidators: true })
      : await Transaction.create(transactionPayload);
    await applyTransactionToWallets(transaction);
    loan.transactionId = transaction._id;
    await loan.save();

    return successResponse(await serializeLoan(loan), 200, "Loan updated successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to update loan");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");
    const { id } = await params;
    const { loan, error, status } = await findOwnedLoan(id, userId);
    if (error) return errorResponse(null, status, error);

    const payments = await LoanPayment.find({ loanId: loan._id });
    for (const payment of payments) {
      if (payment.transactionId) {
        const transaction = await Transaction.findByIdAndDelete(payment.transactionId);
        if (transaction) await reverseTransactionFromWallets(transaction);
      }
      await LoanPayment.findByIdAndDelete(payment._id);
    }

    if (loan.transactionId) {
      const transaction = await Transaction.findByIdAndDelete(loan.transactionId);
      if (transaction) await reverseTransactionFromWallets(transaction);
    }

    await Loan.findByIdAndDelete(loan._id);
    return successResponse(loan, 200, "Loan deleted successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to delete loan");
  }
}
