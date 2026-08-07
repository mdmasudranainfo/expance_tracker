import { Document, Types } from "mongoose";
import { CurrencyInfo } from "../utils/currency";

export interface IWorkspace extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  ownerId: Types.ObjectId;
  isPersonal: boolean;
  isDefault: boolean;
  currency: CurrencyInfo;
  createdAt: Date;
  updatedAt: Date;
}

export default IWorkspace;
