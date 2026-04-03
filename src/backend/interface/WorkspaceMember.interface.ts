import { Document, Types } from "mongoose";

export interface IWorkspaceMember extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: "viewer" | "editor";
  invitedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export default IWorkspaceMember;
