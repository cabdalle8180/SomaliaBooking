import { Router } from "express";
import {
  createListing,
  getMyListings,
  updateListing,
  changeListingStatus,
  browseListings,
  getPublicListing,
} from "../controllers/listingController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", browseListings);
router.get("/mine", protect, authorize("owner"), getMyListings);
router.post("/", protect, authorize("owner"), createListing);

router.put(
  "/:id/status",
  protect,
  authorize("owner"),
  changeListingStatus
);
router.put("/:id", protect, authorize("owner"), updateListing);
router.get("/:id", getPublicListing);

export default router;