import { NextRequest } from "next/server";
import { connectMongoDB } from "@/src/backend/lib/mongodb";
import Loan from "@/src/backend/models/Loan";
import LoanPayment from "@/src/backend/models/LoanPayment";
import Transaction from "@/src/backend/models/Transaction";
import Wallet from "@/src/backend/models/Wallet";
import Workspace from "@/src/backend/models/Workspace";
import { calculateLoanStatus, normalizeLoanTotals } from "@/src/backend/utils/loans";
import { applyTransactionToWallets } from "@/src/backend/utils/transactions";
import { errorResponse, successResponse } from "@/src/backend/utils/Response";

const getUserId = (req: NextRequest) => req.headers.get("id");

const getDefaultWorkspace = async (userId: string) =>
  Workspace.findOne({ ownerId: userId, isDefault: true });

const ensureWalletInWorkspace = async (walletId: string, workspaceId: string) => {
  const wallet = await Wallet.findOne({ _id: walletId, workspaceId });
  if (!wallet) throw new Error("Wallet not found in this workspace");
  return wallet;
};

const serializeLoan = async (loan: any) => {
  const payments = await LoanPayment.find({ loanId: loan._id }).sort({ paymentDate: -1, createdAt: -1 });
  return {
    ...loan.toObject(),
    payments,
  };
};

export async function GET(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const workspace = await getDefaultWorkspace(userId);
    if (!workspace) return errorResponse(null, 403, "Forbidden: Workspace not found or you don't have access");

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "all";
    const query: any = { workspaceId: workspace._id, userId };
    await Loan.updateMany(
      {
        workspaceId: workspace._id,
        userId,
        status: { $in: ["active", "partially_paid"] },
        remainingAmount: { $gt: 0 },
        dueDate: { $lt: new Date() },
      },
      { $set: { status: "overdue" } },
    );

    if (filter === "borrowed" || filter === "lent") query.type = filter;
    if (["active", "overdue", "paid", "cancelled"].includes(filter)) query.status = filter;
    if (filter === "completed") query.status = "paid";

    const loans = await Loan.find(query)
      .sort({ status: 1, dueDate: 1, createdAt: -1 })
      .populate("walletId transactionId");

    const now = new Date();
    const inSevenDays = new Date(now);
    inSevenDays.setDate(inSevenDays.getDate() + 7);

    const summaryLoans = await Loan.find({ workspaceId: workspace._id, userId });
    const summary = summaryLoans.reduce(
      (acc, loan) => {
        if (loan.type === "borrowed") {
          acc.totalBorrowed += loan.totalPayable;
          acc.totalBorrowedRemaining += loan.remainingAmount;
        } else {
          acc.totalLent += loan.totalPayable;
          acc.totalLentRemaining += loan.remainingAmount;
        }
        if (!["paid", "cancelled"].includes(loan.status)) acc.totalActiveLoans += 1;
        if (loan.status === "overdue") acc.overdueLoans += 1;
        if (loan.remainingAmount > 0 && new Date(loan.dueDate) >= now && new Date(loan.dueDate) <= inSevenDays) {
          acc.upcomingPayments += 1;
        }
        return acc;
      },
      {
        totalBorrowed: 0,
        totalLent: 0,
        totalBorrowedRemaining: 0,
        totalLentRemaining: 0,
        totalActiveLoans: 0,
        overdueLoans: 0,
        upcomingPayments: 0,
      },
    );

    const loansWithPayments = await Promise.all(loans.map((loan) => serializeLoan(loan)));

    return successResponse({ loans: loansWithPayments, summary }, 200, "Loans fetched successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to fetch loans");
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectMongoDB();
    const userId = getUserId(req);
    if (!userId) return errorResponse(null, 401, "Unauthorized");

    const body = await req.json();
    const workspaceId = body.workspaceId;
    const workspace = workspaceId
      ? await Workspace.findOne({ _id: workspaceId, ownerId: userId })
      : await getDefaultWorkspace(userId);
    if (!workspace) return errorResponse(null, 403, "Forbidden: Workspace not found or you don't have access");

    const amount = Number(body.amount || 0);
    const interest = Number(body.interest || 0);
    if (!["borrowed", "lent"].includes(body.type)) return errorResponse(null, 400, "Loan type is required");
    if (!String(body.personName || "").trim()) return errorResponse(null, 400, "Person name is required");
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse(null, 400, "Amount must be greater than zero");
    if (interest < 0) return errorResponse(null, 400, "Interest cannot be negative");
    if (!body.walletId) return errorResponse(null, 400, "Wallet is required");
    if (!body.dueDate) return errorResponse(null, 400, "Due date is required");
    await ensureWalletInWorkspace(body.walletId, workspace._id.toString());

    const totals = normalizeLoanTotals(amount, interest);
    const loan = await Loan.create({
      workspaceId: workspace._id,
      userId,
      type: body.type,
      personName: String(body.personName).trim(),
      personPhone: String(body.personPhone || "").trim(),
      amount,
      interest,
      ...totals,
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      dueDate: new Date(body.dueDate),
      installmentAmount: Number(body.installmentAmount || 0),
      frequency: body.frequency || "one_time",
      walletId: body.walletId,
      note: String(body.note || "").trim(),
    });

    loan.status = calculateLoanStatus(loan.remainingAmount, loan.totalPayable, loan.dueDate);
    await loan.save();

    const transaction = await Transaction.create({
      workspaceId: workspace._id,
      userId,
      walletId: body.walletId,
      type: body.type === "borrowed" ? "loan_received" : "loan_given",
      amount,
      note: body.note || `${body.type === "borrowed" ? "Borrowed from" : "Lent to"} ${loan.personName}`,
      date: loan.startDate,
      loanId: loan._id,
      personName: loan.personName,
    });
    await applyTransactionToWallets(transaction);

    loan.transactionId = transaction._id;
    await loan.save();

    return successResponse(await serializeLoan(loan), 201, "Loan created successfully");
  } catch (error: any) {
    return errorResponse(null, 500, error.message || "Failed to create loan");
  }
}
