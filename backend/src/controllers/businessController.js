import mongoose from "mongoose";
import Business from "../models/business.js";

const profileFields = ["name", "description", "contactPhone", "city"];

const isObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

const isValidId = (id) => mongoose.isObjectIdOrHexString(id);

const handleError = (res, error) => {
  if (error.code === 11000) {
    return res.status(409).json({
      message: "This owner already has a business",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: error.message,
    });
  }

  console.error("Business request failed:", error);

  return res.status(500).json({
    message: "Internal server error",
  });
};

const readProfile = (body, { partial = false } = {}) => {
  if (!isObject(body)) {
    return {
      error: "Request body must be an object",
    };
  }

  const keys = Object.keys(body);

  if (
    !keys.length ||
    keys.some((key) => !profileFields.includes(key))
  ) {
    return {
      error:
        "Only name, description, contactPhone, and city are allowed",
    };
  }

  const data = {};

  for (const key of keys) {
    if (typeof body[key] !== "string") {
      return {
        error: `${key} must be a string`,
      };
    }

    data[key] = body[key].trim();
  }

  if (!partial) {
    for (const key of ["name", "contactPhone", "city"]) {
      if (!data[key]) {
        return {
          error: `${key} is required`,
        };
      }
    }
  }

  for (const key of ["name", "contactPhone", "city"]) {
    if (key in data && !data[key]) {
      return {
        error: `${key} cannot be empty`,
      };
    }
  }

  if (
    "contactPhone" in data &&
    !/^\+?[0-9][0-9()\-\s]{6,24}$/.test(data.contactPhone)
  ) {
    return {
      error: "Enter a valid contact phone number",
    };
  }

  if (
    ("name" in data && data.name.length > 120) ||
    ("description" in data && data.description.length > 2000) ||
    ("contactPhone" in data && data.contactPhone.length > 25) ||
    ("city" in data && data.city.length > 100)
  ) {
    return {
      error: "One or more fields exceed the allowed length",
    };
  }

  return { data };
};

const pagination = (query) => {
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

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

// POST /api/businesses
export const createBusiness = async (req, res) => {
  const { data, error } = readProfile(req.body);

  if (error) {
    return res.status(400).json({
      message: error,
    });
  }

  try {
    const business = await Business.create({
      ...data,
      ownerId: req.user._id,
    });

    return res.status(201).json({
      business,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/businesses
export const listBusinesses = async (req, res) => {
  const paging = pagination(req.query);

  if (!paging) {
    return res.status(400).json({
      message: "Invalid pagination values",
    });
  }

  try {
    const filter = {
      status: "ACTIVE",
    };

    const [businesses, total] = await Promise.all([
      Business.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(paging.skip)
        .limit(paging.limit)
        .lean(),

      Business.countDocuments(filter),
    ]);

    return res.json({
      businesses,
      pagination: {
        page: paging.page,
        limit: paging.limit,
        total,
        totalPages: Math.ceil(total / paging.limit),
      },
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/businesses/mine
export const getMyBusiness = async (req, res) => {
  try {
    const business = await Business.findOne({
      ownerId: req.user._id,
    });

    if (!business) {
      return res.status(404).json({
        message: "Business not found",
      });
    }

    return res.json({
      business,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/businesses/mine
export const updateMyBusiness = async (req, res) => {
  const { data, error } = readProfile(req.body, {
    partial: true,
  });

  if (error) {
    return res.status(400).json({
      message: error,
    });
  }

  try {
    const business = await Business.findOneAndUpdate(
      {
        ownerId: req.user._id,
      },
      {
        $set: data,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!business) {
      return res.status(404).json({
        message: "Business not found",
      });
    }

    return res.json({
      business,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/businesses/:id
export const getBusiness = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid business ID",
    });
  }

  try {
    const business = await Business.findOne({
      _id: req.params.id,
      status: "ACTIVE",
    }).lean();

    if (!business) {
      return res.status(404).json({
        message: "Business not found",
      });
    }

    return res.json({
      business,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/businesses/admin/all
export const adminListBusinesses = async (req, res) => {
  const paging = pagination(req.query);

  if (!paging) {
    return res.status(400).json({
      message: "Invalid pagination values",
    });
  }

  const { status } = req.query;

  if (
    status !== undefined &&
    !["ACTIVE", "SUSPENDED"].includes(status)
  ) {
    return res.status(400).json({
      message: "Invalid status filter",
    });
  }

  try {
    const filter = status ? { status } : {};

    const [businesses, total] = await Promise.all([
      Business.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(paging.skip)
        .limit(paging.limit)
        .lean(),

      Business.countDocuments(filter),
    ]);

    return res.json({
      businesses,
      pagination: {
        page: paging.page,
        limit: paging.limit,
        total,
        totalPages: Math.ceil(total / paging.limit),
      },
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/businesses/admin/:id/status
export const setBusinessStatus = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid business ID",
    });
  }

  if (
    !isObject(req.body) ||
    Object.keys(req.body).length !== 1 ||
    !["ACTIVE", "SUSPENDED"].includes(req.body.status)
  ) {
    return res.status(400).json({
      message: "Status must be ACTIVE or SUSPENDED",
    });
  }

  try {
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: req.body.status,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!business) {
      return res.status(404).json({
        message: "Business not found",
      });
    }

    return res.json({
      business,
    });
  } catch (err) {
    return handleError(res, err);
  }
};