
import mongoose, { mongo } from "mongoose";
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
 
    role: {
      type: String,
      enum: ["admin", "user"],
      required: true,
      default: "user",
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
   
    password: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },

    defaultWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },


    provider: {
      type: String,
      enum: ["credentials", "google"],
      required: true,
      default: "credentials",
    },
 
  },
  {
    timestamps: true,
  }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;