import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isPersonal: {
      type: Boolean,
      default: false,
    },
    currency: {
      type: String,
      required: true,
      default: "BDT",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster owner lookups
workspaceSchema.index({ ownerId: 1 });

const Workspace = mongoose.models.Workspace || mongoose.model("Workspace", workspaceSchema);

export default Workspace;
