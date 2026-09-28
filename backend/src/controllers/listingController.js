import mongoose from "mongoose";
import Business from "../models/business.js";
import Listing from "../models/listing.js";

const editableFields = [
  "category",
  "title",
  "description",
  "city",
  "address",
  "timeZone",
  "imageUrls",
];

const categories = ["HOTEL", "CAR", "APARTMENT"];
const validId = (id) => mongoose.isObjectIdOrHexString(id);
const plainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function validateInput(body, { partial = false } = {}) {
  if (!plainObject(body)) return { error: "Body must be an object" };

  const keys = Object.keys(body);

  if (!keys.length || keys.some((key) => !editableFields.includes(key))) {
    return { error: `Allowed fields: ${editableFields.join(", ")}` };
  }

  const data = {};

  for (const key of keys) {
    if (key === "imageUrls") {
      if (
        !Array.isArray(body.imageUrls) ||
        body.imageUrls.length > 20 ||
        body.imageUrls.some((url) => typeof url !== "string")
      ) {
        return { error: "imageUrls must contain at most 20 URL strings" };
      }

      data.imageUrls = body.imageUrls.map((url) => url.trim());
    } else {
      if (typeof body[key] !== "string") {
        return { error: `${key} must be a string` };
      }

      data[key] = body[key].trim();
    }
  }

  if (!partial) {
    for (const key of editableFields.filter((field) => field !== "imageUrls")) {
      if (!data[key]) return { error: `${key} is required` };
    }
  }

  for (const key of keys.filter((field) => field !== "imageUrls")) {
    if (!data[key]) return { error: `${key} cannot be empty` };
  }

  if ("category" in data && !categories.includes(data.category)) {
    return { error: "Invalid category" };
  }

  if ("city" in data) data.city = data.city.toLowerCase();

  return { data };
}

function pageOptions(query) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 12);

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

function fail(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({ message: error.message });
  }

  console.error("Listing request failed:", error);
  return res.status(500).json({ message: "Internal server error" });
}

async function ownerBusiness(userId) {
  return Business.findOne({ ownerId: userId }).select("_id status");
}

// POST /api/listings
export const createListing = async (req, res) => {
  const { data, error } = validateInput(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const business = await ownerBusiness(req.user._id);

    if (!business) {
      return res.status(403).json({ message: "Create a business first" });
    }
    if (business.status !== "ACTIVE") {
      return res.status(403).json({ message: "Business is suspended" });
    }

    const listing = await Listing.create({
      ...data,
      businessId: business._id,
      status: "DRAFT",
    });

    return res.status(201).json({ listing });
  } catch (err) {
    return fail(res, err);
  }
};

// GET /api/listings/mine
export const getMyListings = async (req, res) => {
  const paging = pageOptions(req.query);
  if (!paging) return res.status(400).json({ message: "Invalid pagination" });

  try {
    const business = await ownerBusiness(req.user._id);
    if (!business) {
      return res.json({
        listings: [],
        pagination: { page: paging.page, limit: paging.limit, total: 0 },
      });
    }

    const filter = { businessId: business._id };
    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(paging.skip)
        .limit(paging.limit)
        .lean(),
      Listing.countDocuments(filter),
    ]);

    return res.json({
      listings,
      pagination: { page: paging.page, limit: paging.limit, total },
    });
  } catch (err) {
    return fail(res, err);
  }
};

// PATCH /api/listings/:id
export const updateListing = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid listing ID" });
  }

  const { data, error } = validateInput(req.body, { partial: true });
  if (error) return res.status(400).json({ message: error });

  try {
    const business = await ownerBusiness(req.user._id);

    if (!business || business.status !== "ACTIVE") {
      return res.status(403).json({ message: "Active business required" });
    }

    const listing = await Listing.findOneAndUpdate(
      {
        _id: req.params.id,
        businessId: business._id,
        status: { $ne: "ARCHIVED" },
      },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!listing) {
      return res.status(404).json({
        message: "Listing not found or archived",
      });
    }

    return res.json({ listing });
  } catch (err) {
    return fail(res, err);
  }
};

// PATCH /api/listings/:id/status
export const changeListingStatus = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid listing ID" });
  }

  if (
    !plainObject(req.body) ||
    Object.keys(req.body).length !== 1 ||
    !["PUBLISHED", "ARCHIVED"].includes(req.body.status)
  ) {
    return res.status(400).json({
      message: "Status must be PUBLISHED or ARCHIVED",
    });
  }

  try {
    const business = await ownerBusiness(req.user._id);

    if (!business || business.status !== "ACTIVE") {
      return res.status(403).json({ message: "Active business required" });
    }

    const allowedCurrentStatus =
      req.body.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

    const listing = await Listing.findOneAndUpdate(
      {
        _id: req.params.id,
        businessId: business._id,
        status: allowedCurrentStatus,
      },
      { $set: { status: req.body.status } },
      { new: true, runValidators: true }
    );

    if (!listing) {
      return res.status(409).json({
        message: `Listing not found or cannot transition to ${req.body.status}`,
      });
    }

    return res.json({ listing });
  } catch (err) {
    return fail(res, err);
  }
};

// GET /api/listings?category=HOTEL&city=mogadishu&page=1&limit=12
export const browseListings = async (req, res) => {
  const paging = pageOptions(req.query);
  if (!paging) return res.status(400).json({ message: "Invalid pagination" });

  const { category, city } = req.query;

  if (category !== undefined && !categories.includes(category)) {
    return res.status(400).json({ message: "Invalid category" });
  }
  if (
    city !== undefined &&
    (typeof city !== "string" || !city.trim() || city.length > 100)
  ) {
    return res.status(400).json({ message: "Invalid city" });
  }

  try {
    const match = {
      status: "PUBLISHED",
      ...(category ? { category } : {}),
      ...(city ? { city: city.trim().toLowerCase() } : {}),
    };

    // The join excludes listings whose business has been suspended.
    const [result] = await Listing.aggregate([
      { $match: match },
      {
        $lookup: {
          from: Business.collection.name,
          localField: "businessId",
          foreignField: "_id",
          as: "business",
        },
      },
      { $unwind: "$business" },
      { $match: { "business.status": "ACTIVE" } },
      {
        $facet: {
          listings: [
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: paging.skip },
            { $limit: paging.limit },
            { $project: { business: 0 } },
          ],
          count: [{ $count: "total" }],
        },
      },
    ]);

    return res.json({
      listings: result.listings,
      pagination: {
        page: paging.page,
        limit: paging.limit,
        total: result.count[0]?.total ?? 0,
      },
    });
  } catch (err) {
    return fail(res, err);
  }
};

// GET /api/listings/:id
export const getPublicListing = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid listing ID" });
  }

  try {
    const listing = await Listing.findOne({
      _id: req.params.id,
      status: "PUBLISHED",
    }).lean();

    if (
      !listing ||
      !(await Business.exists({
        _id: listing.businessId,
        status: "ACTIVE",
      }))
    ) {
      return res.status(404).json({ message: "Listing not found" });
    }

    return res.json({ listing });
  } catch (err) {
    return fail(res, err);
  }
};