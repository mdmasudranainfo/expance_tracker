import { Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  image?: string;
  provider: "credentials" | "google";
  role: "admin" | "user";
  defaultWorkspaceId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export default IUser;