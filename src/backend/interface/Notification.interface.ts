import { Document, Types } from "mongoose";

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  workspaceId?: Types.ObjectId;
  type: "budget_exceed" | "reminder";
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default INotification;
