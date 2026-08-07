import mongoose from "mongoose";
import { defaultCurrency } from "../utils/currency";

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
      code: {
        type: String,
        required: true,
        default: defaultCurrency.code,
      },
      symbol: {
        type: String,
        required: true,
        default: defaultCurrency.symbol,
      },
      name: {
        type: String,
        required: true,
        default: defaultCurrency.name,
      },
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
