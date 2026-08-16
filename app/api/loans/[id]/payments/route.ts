import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import Loan from "@/src/backend/models/Loan";
import LoanPayment from "@/src/backend/models/LoanPayment";
import Transaction from "@/src/backend/models/Transaction";
import Wallet from "@/src/backend/models/Wallet";
import Workspace from "@/src/backend/models/Workspace";
import { calculateLoanStatus } from "@/src/backend/utils/loans";
import { applyTransactionToWallets } from "@/src/backend/utils/transactions";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";

const getUserId = (req: NextRequest) => req.headers.get("id");

async function findOwnedLoan(id: string, userId: string) {
  const loan = await Loan.findById(id);
  if (!loan) return { error: "Loan not found", status: 404 };
  const workspace = await Workspace.findOne({ _id: loan.workspaceId, ownerId: userId });
  if (!workspace) return { error: "Forbidden: You don't have access to this loan", status: 403 };
  return { loan };
}

const refreshLoanTotals = async (loan: any) => {
  const payments = await LoanPayment.find({ loanId: loan._id });
  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  loan.paidAmount = paidAmount;
  loan.remainingAmount = Math.max(Number(loan.totalPayable || 0) - paidAmount, 0);
  loan.status = calculateLoanStatus(loan.remainingAmount, loan.totalPayable, loan.dueDate, loan.status);
  await loan.save();
  return payments;
};

const serializeLoan = async (loan: any) => {
  const payments = await LoanPayment.find({ loanId: loan._id }).sort({ paymentDate: -1, createdAt: -1 });
  return {
    ...loan.toObject(),
    payments,
  };
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");
    const { id } = await params;
    const { loan, error, status } = await findOwnedLoan(id, userId);
    if (error) return errorResponse(null, status, error);
    if (loan.status === "paid") return errorResponse(null, 400, "Loan is already paid");
    if (loan.status === "cancelled") return errorResponse(null, 400, "Cancelled loans cannot receive payments");

    const body = await req.json();
    const amount = Number(body.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse(null, 400, "Payment amount must be greater than zero");
    if (amount > Number(loan.remainingAmount || 0)) return errorResponse(null, 400, "Payment cannot be greater than remaining amount");

    const walletId = body.walletId || loan.walletId;
    const wallet = await Wallet.findOne({ _id: walletId, workspaceId: loan.workspaceId });
    if (!wallet) return errorResponse(null, 400, "Wallet not found in this workspace");

    const payment = await LoanPayment.create({
      workspaceId: loan.workspaceId,
      userId,
      loanId: loan._id,
      amount,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
      walletId,
      note: String(body.note || "").trim(),
    });

    const transaction = await Transaction.create({
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
    });
    await applyTransactionToWallets(transaction);

    payment.transactionId = transaction._id;
    await payment.save();
    await refreshLoanTotals(loan);

    return successResponse({ loan: await serializeLoan(loan), payment }, 201, "Loan payment recorded successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to record loan payment");
  }
}
