import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config({ path : "./.env" });

connectDB()
    .then(() => {
        app.listen(process.env.PORT || 3000, () => {
            console.log(`Video server running on port ${process.env.PORT || 3000}`);
        })
        app.on("error", () => {
            console.log("MongoDB connection error. Please make sure MongoDB is running.");
        })
    })
    .catch((error) => {
        console.error("MongoDB connection failed: ", error);
    });