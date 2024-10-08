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











































// import express from "express";

// const app = express();

// (async () => {
//     try {
//         const conn = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
//         app.on("error", () => {
//             console.log("MongoDB connection error. Please make sure MongoDB is running.");
//             throw error
//         })
//         app.listen(process.env.PORT || 3000, () => console.log(`Video server running on port ${process.env.PORT || 3000}`))
//     } catch (error) {
//         console.error(`Error: ${error}`);
//         throw error
//     }
// })();
