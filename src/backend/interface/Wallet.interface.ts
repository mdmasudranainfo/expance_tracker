import { Document, Types } from "mongoose";

export interface IWallet extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  type: "cash" | "bank" | "mobile";
  balance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export default IWallet;
