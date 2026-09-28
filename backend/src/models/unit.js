import mongoose from "mongoose";

const positiveInteger = {
  type: Number,
  required: true,
  min: 1,
  validate: Number.isSafeInteger,
};

const nonNegativeInteger = {
  type: Number,
  required: true,
  min: 0,
  validate: Number.isSafeInteger,
};

const hotelSchema = new mongoose.Schema(
  {
    roomType: { type: String, required: true, trim: true, maxlength: 80 },
    beds: positiveInteger,
    capacity: positiveInteger,
  },
  { _id: false }
);

const carSchema = new mongoose.Schema(
  {
    make: { type: String, required: true, trim: true, maxlength: 80 },
    model: { type: String, required: true, trim: true, maxlength: 80 },
    seats: positiveInteger,
    plateNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
  },
  { _id: false }
);

const apartmentSchema = new mongoose.Schema(
  {
    bedrooms: nonNegativeInteger, // 0 permits a studio apartment
    bathrooms: positiveInteger,
    maxGuests: positiveInteger,
  },
  { _id: false }
);

const unitSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      immutable: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    priceMinor: positiveInteger,
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: /^[A-Z]{3}$/,
    },
    active: {
      type: Boolean,
      default: true,
      required: true,
    },
    availabilityVersion: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    details: {
      hotel: { type: hotelSchema },
      car: { type: carSchema },
      apartment: { type: apartmentSchema },
    },
  },
  { timestamps: true }
);

// A business may reuse "ROOM-1" on another listing, but not on this one.
unitSchema.index({ listingId: 1, code: 1 }, { unique: true });
unitSchema.index({ listingId: 1, active: 1 });

// Used on creation. The controller also checks this rule on updates.
unitSchema.pre("validate", function () {
  const kinds = ["hotel", "car", "apartment"];
  const supplied = kinds.filter((kind) => this.details?.[kind] != null);

  if (supplied.length !== 1) {
    this.invalidate("details", "Provide exactly one category details object");
  }
});

const Unit = mongoose.model("Unit", unitSchema);
export default Unit;