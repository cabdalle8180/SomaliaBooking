import { Router } from "express";
import {
  createUnit,
  getMyUnits,
  updateUnit,
  setUnitActive,
  getPublicUnits,
} from "../controllers/unitController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/listing/:listingId", getPublicUnits);

router.get(
  "/mine/:listingId",
  protect,
  authorize("owner"),
  getMyUnits
);
router.post("/", protect, authorize("owner"), createUnit);
router.put(
  "/:id/active",
  protect,
  authorize("owner"),
  setUnitActive
);
router.put("/:id", protect, authorize("owner"), updateUnit);

export default router;