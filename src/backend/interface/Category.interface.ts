import { Document, Types } from "mongoose";

export interface ICategory extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  type: "expense" | "income";
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default ICategory;
