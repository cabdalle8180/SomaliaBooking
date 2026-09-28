
import { Router } from "express";

import {
  createBusiness,
  listBusinesses,
  getBusiness,
  getMyBusiness,
  updateMyBusiness,
  adminListBusinesses,
  setBusinessStatus,
} from "../controllers/businessController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", listBusinesses);

router.post(
  "/",
  protect,
  authorize("owner"),
  createBusiness
);

router.get(
  "/mine",
  protect,
  authorize("owner"),
  getMyBusiness
);

router.put(
  "/mine",
  protect,
  authorize("owner"),
  updateMyBusiness
);

router.get(
  "/admin/all",
  protect,
  authorize("admin"),
  adminListBusinesses
);

router.put(
  "/admin/:id/status",
  protect,
  authorize("admin"),
  setBusinessStatus
);

router.get("/:id", getBusiness);

export default router;

