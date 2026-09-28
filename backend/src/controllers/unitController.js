import mongoose from "mongoose";
import Business from "../models/business.js";
import Listing from "../models/listing.js";
import Unit from "../models/unit.js";

const validId = (id) => mongoose.isObjectIdOrHexString(id);
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const fields = ["code", "title", "priceMinor", "currency", "details"];

const detailShapes = {
  HOTEL: ["roomType", "beds", "capacity"],
  CAR: ["make", "model", "seats", "plateNumber"],
  APARTMENT: ["bedrooms", "bathrooms", "maxGuests"],
};

const detailKey = {
  HOTEL: "hotel",
  CAR: "car",
  APARTMENT: "apartment",
};

function parseUnit(body, category, partial = false) {
  if (!isObject(body)) return { error: "Body must be an object" };

  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !fields.includes(key))) {
    return { error: `Allowed fields: ${fields.join(", ")}` };
  }

  if (!partial && fields.some((key) => !(key in body))) {
    return { error: "All unit fields are required" };
  }

  const data = {};

  for (const key of ["code", "title", "currency"]) {
    if (!(key in body)) continue;
    if (typeof body[key] !== "string" || !body[key].trim()) {
      return { error: `${key} must be a nonempty string` };
    }
    data[key] = body[key].trim();
  }

  if ("code" in data) data.code = data.code.toUpperCase();
  if ("currency" in data) data.currency = data.currency.toUpperCase();

  if (
    ("code" in data && data.code.length > 60) ||
    ("title" in data && data.title.length > 160) ||
    ("currency" in data && !/^[A-Z]{3}$/.test(data.currency))
  ) {
    return { error: "Invalid code, title, or currency" };
  }

  if ("priceMinor" in body) {
    if (!Number.isSafeInteger(body.priceMinor) || body.priceMinor <= 0) {
      return { error: "priceMinor must be a positive integer" };
    }
    data.priceMinor = body.priceMinor;
  }

  if ("details" in body) {
    const kind = detailKey[category];
    const expected = detailShapes[category];

    if (
      !kind ||
      !isObject(body.details) ||
      Object.keys(body.details).length !== 1 ||
      !isObject(body.details[kind])
    ) {
      return { error: `Provide only details.${kind}` };
    }

    const values = body.details[kind];

    if (
      Object.keys(values).length !== expected.length ||
      expected.some((field) => !(field in values))
    ) {
      return { error: `Required ${kind} fields: ${expected.join(", ")}` };
    }

    const cleaned = {};

    for (const field of expected) {
      if (typeof values[field] === "string") {
        if (!values[field].trim()) {
          return { error: `${field} cannot be empty` };
        }
        cleaned[field] = values[field].trim();
      } else if (typeof values[field] === "number") {
        const min =
          category === "APARTMENT" && field === "bedrooms" ? 0 : 1;

        if (!Number.isSafeInteger(values[field]) || values[field] < min) {
          return { error: `${field} must be an integer of at least ${min}` };
        }
        cleaned[field] = values[field];
      } else {
        return { error: `Invalid ${field}` };
      }
    }

    // Reject numbers in text fields and text in numeric fields.
    const textFields =
      category === "HOTEL"
        ? ["roomType"]
        : category === "CAR"
          ? ["make", "model", "plateNumber"]
          : [];

    if (
      textFields.some((field) => typeof cleaned[field] !== "string") ||
      expected
        .filter((field) => !textFields.includes(field))
        .some((field) => typeof cleaned[field] !== "number")
    ) {
      return { error: "Invalid details field types" };
    }

    data.details = { [kind]: cleaned };
  }

  return { data };
}

function pagination(query) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    return null;
  }

  return { page, limit, skip: (page - 1) * limit };
}

function handleError(res, error) {
  if (error.code === 11000) {
    return res.status(409).json({
      message: "Unit code already exists in this listing",
    });
  }
  if (error.name === "ValidationError") {
    return res.status(400).json({ message: error.message });
  }

  console.error("Unit request failed:", error);
  return res.status(500).json({ message: "Internal server error" });
}

async function getOwnerListing(userId, listingId) {
  const business = await Business.findOne({
    ownerId: userId,
    status: "ACTIVE",
  }).select("_id");

  if (!business) return null;

  return Listing.findOne({
    _id: listingId,
    businessId: business._id,
    status: { $ne: "ARCHIVED" },
  }).select("_id category status");
}

// POST /api/units
export const createUnit = async (req, res) => {
  const { listingId } = req.body ?? {};

  if (!validId(listingId)) {
    return res.status(400).json({ message: "Valid listingId is required" });
  }

  try {
    const listing = await getOwnerListing(req.user._id, listingId);
    if (!listing) {
      return res.status(404).json({ message: "Active listing not found" });
    }

    const { listingId: _ignored, ...input } = req.body;
    const { data, error } = parseUnit(input, listing.category);

    if (error) return res.status(400).json({ message: error });

    const unit = await Unit.create({
      listingId: listing._id,
      ...data,
    });

    return res.status(201).json({ unit });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/units/mine/:listingId
export const getMyUnits = async (req, res) => {
  if (!validId(req.params.listingId)) {
    return res.status(400).json({ message: "Invalid listing ID" });
  }

  const paging = pagination(req.query);
  if (!paging) return res.status(400).json({ message: "Invalid pagination" });

  try {
    const listing = await getOwnerListing(
      req.user._id,
      req.params.listingId
    );

    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    const filter = { listingId: listing._id };
    const [units, total] = await Promise.all([
      Unit.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(paging.skip)
        .limit(paging.limit)
        .lean(),
      Unit.countDocuments(filter),
    ]);

    return res.json({
      units,
      pagination: { page: paging.page, limit: paging.limit, total },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/units/:id
export const updateUnit = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid unit ID" });
  }

  try {
    const existing = await Unit.findById(req.params.id)
      .select("listingId")
      .lean();

    if (!existing) {
      return res.status(404).json({ message: "Unit not found" });
    }

    const listing = await getOwnerListing(
      req.user._id,
      existing.listingId
    );

    if (!listing) {
      return res.status(404).json({ message: "Unit not found" });
    }

    const { data, error } = parseUnit(req.body, listing.category, true);
    if (error) return res.status(400).json({ message: error });

    const unit = await Unit.findOneAndUpdate(
      { _id: req.params.id, listingId: listing._id },
      { $set: data },
      { new: true, runValidators: true }
    );

    return res.json({ unit });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/units/:id/active
export const setUnitActive = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid unit ID" });
  }

  if (
    !isObject(req.body) ||
    Object.keys(req.body).length !== 1 ||
    typeof req.body.active !== "boolean"
  ) {
    return res.status(400).json({ message: "active must be a boolean" });
  }

  try {
    const existing = await Unit.findById(req.params.id)
      .select("listingId active")
      .lean();

    if (!existing) {
      return res.status(404).json({ message: "Unit not found" });
    }

    const listing = await getOwnerListing(
      req.user._id,
      existing.listingId
    );

    if (!listing) {
      return res.status(404).json({ message: "Unit not found" });
    }

    // Increment the version only if active actually changes.
    const changed = await Unit.findOneAndUpdate(
      {
        _id: existing._id,
        listingId: listing._id,
        active: !req.body.active,
      },
      {
        $set: { active: req.body.active },
        $inc: { availabilityVersion: 1 },
      },
      { new: true, runValidators: true }
    );

    if (changed) return res.json({ unit: changed });

    const current = await Unit.findOne({
      _id: existing._id,
      listingId: listing._id,
    });

    return res.json({ unit: current });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/units/listing/:listingId
export const getPublicUnits = async (req, res) => {
  if (!validId(req.params.listingId)) {
    return res.status(400).json({ message: "Invalid listing ID" });
  }

  try {
    const listing = await Listing.findOne({
      _id: req.params.listingId,
      status: "PUBLISHED",
    }).select("businessId");

    if (
      !listing ||
      !(await Business.exists({
        _id: listing.businessId,
        status: "ACTIVE",
      }))
    ) {
      return res.status(404).json({ message: "Listing not found" });
    }

    const units = await Unit.find({
      listingId: listing._id,
      active: true,
    })
      .select("-details.car.plateNumber")
      .sort({ priceMinor: 1, _id: 1 })
      .lean();

    return res.json({ units });
  } catch (error) {
    return handleError(res, error);
  }
};