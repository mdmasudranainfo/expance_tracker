export const calculateLoanStatus = (
  remainingAmount: number,
  totalPayable: number,
  dueDate: Date | string,
  currentStatus?: string,
) => {
  if (currentStatus === "cancelled") return "cancelled";
  if (remainingAmount <= 0) return "paid";
  if (new Date(dueDate).getTime() < Date.now()) return "overdue";
  if (remainingAmount < totalPayable) return "partially_paid";
  return "active";
};

export const normalizeLoanTotals = (amount: number, interest = 0, paidAmount = 0) => {
  const totalPayable = Number(amount || 0) + Number(interest || 0);
  const paid = Math.min(Number(paidAmount || 0), totalPayable);
  const remainingAmount = Math.max(totalPayable - paid, 0);
  return {
    totalPayable,
    paidAmount: paid,
    remainingAmount,
  };
};
