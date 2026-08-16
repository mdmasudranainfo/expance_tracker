import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "PENDING",
    },
    notificationEnabled: {
      type: Boolean,
      default: true,
    },
    notificationMinutesBefore: {
      type: Number,
      default: 10,
      min: 0,
    },
    notificationId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

taskSchema.index({ workspaceId: 1, createdBy: 1 });
taskSchema.index({ date: 1, time: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ priority: 1 });

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

export default Task;
