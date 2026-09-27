import experess from "express";
import dotenv from "dotenv";
import connectDB from "./config/dbs.js";
dotenv.config();

const app = experess();


app.get("/", (req,res)=>{
    res.send("Hello from backend");
})


const PORT = process.env.PORT || 5000;
connectDB();
app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});