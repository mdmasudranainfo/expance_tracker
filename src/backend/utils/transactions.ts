import Wallet from "@/src/backend/models/Wallet";

const loanIncomingTypes = ["loan_received", "loan_received_back"];
const loanOutgoingTypes = ["loan_given", "loan_payment"];

export const loanTransactionTypes = [
  "loan_received",
  "loan_given",
  "loan_payment",
  "loan_received_back",
];

export async function applyTransactionToWallets(transaction: any) {
  const amount = Number(transaction.amount);

  if (transaction.type === "expense" || loanOutgoingTypes.includes(transaction.type)) {
    await Wallet.findByIdAndUpdate(transaction.walletId, {
      $inc: { balance: -amount },
    });
  } else if (transaction.type === "income" || loanIncomingTypes.includes(transaction.type)) {
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

export async function reverseTransactionFromWallets(transaction: any) {
  const amount = Number(transaction.amount);

  if (transaction.type === "expense" || loanOutgoingTypes.includes(transaction.type)) {
    await Wallet.findByIdAndUpdate(transaction.walletId, {
      $inc: { balance: amount },
    });
  } else if (transaction.type === "income" || loanIncomingTypes.includes(transaction.type)) {
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
