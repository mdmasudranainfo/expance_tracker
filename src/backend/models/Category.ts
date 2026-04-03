import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["expense", "income"],
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster workspace and type lookups
categorySchema.index({ workspaceId: 1, type: 1 });

const Category = mongoose.models.Category || mongoose.model("Category", categorySchema);

export default Category;
