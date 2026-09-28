import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      immutable: true,
    },
    category: {
      type: String,
      enum: ["HOTEL", "CAR", "APARTMENT"],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    timeZone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator(value) {
          try {
            // Accept IANA region names such as Africa/Mogadishu, plus UTC.
            if (
              value !== "UTC" &&
              !/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+$/.test(value)
            ) {
              return false;
            }

            new Intl.DateTimeFormat("en-US", { timeZone: value });
            return true;
          } catch {
            return false;
          }
        },
        message: "timeZone must be a valid IANA time zone",
      },
    },
    imageUrls: {
      type: [String],
      default: [],
      validate: {
        validator(urls) {
          return (
            urls.length <= 20 &&
            urls.every((url) => {
              try {
                return new URL(url).protocol === "https:";
              } catch {
                return false;
              }
            })
          );
        },
        message: "Provide at most 20 valid HTTPS image URLs",
      },
    },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      default: "DRAFT",
      required: true,
    },
  },
  { timestamps: true }
);

// Requested browse and owner-management indexes.
listingSchema.index({ category: 1, city: 1, status: 1 });
listingSchema.index({ businessId: 1, createdAt: -1 });

const Listing = mongoose.model("Listing", listingSchema);
export default Listing;


