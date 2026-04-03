import { Document, Types } from "mongoose";

export interface IWorkspace extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  ownerId: Types.ObjectId;
  isPersonal: boolean;
  isDefault: boolean;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export default IWorkspace;
