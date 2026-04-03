import { Document, Types } from "mongoose";

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  walletId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  type: "expense" | "income" | "transfer";
  amount: number;
  note?: string;
  date: Date;
  receiptUrl?: string;
  fromWalletId?: Types.ObjectId;
  toWalletId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export default ITransaction;
