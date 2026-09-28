import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/dbs.js";
import authRoutes from "./routes/authroutes.js";
import businessRoutes from "./routes/businessRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";
import unitRoutes from "./routes/unitRoutes.js";



dotenv.config();

const app = express();
app.use(express.json());

// routes
app.use("/api/auth", authRoutes);

// businessRoutes
app.use("/api/business", businessRoutes);
//listinRoutes
app.use("/api/listings", listingRoutes);
// unitRoutes
app.use("/api/units", unitRoutes);



const PORT = process.env.PORT || 5000;
connectDB();
app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});