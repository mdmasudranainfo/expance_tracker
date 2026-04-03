import { Document, Types } from "mongoose";

export interface IBudget extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  categoryId?: Types.ObjectId;
  amount: number;
  month: number;
  year: number;
  createdAt: Date;
  updatedAt: Date;
}

export default IBudget;
