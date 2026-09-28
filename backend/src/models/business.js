import mongoose from "mongoose";

const businessSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 25,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE",
      required: true,
    },
  },
  { timestamps: true }
);

businessSchema.index({ status: 1, createdAt: -1 });

const Business = mongoose.model("Business", businessSchema);
export default Business;