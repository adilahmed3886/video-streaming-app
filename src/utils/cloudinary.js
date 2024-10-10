import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = async (file) => {
    try {
        if(!file)return null
        const response = awaitcloudinary.uploader.upload(file, {
            resource_type: "auto",
        })
        console.log("file uploaded", response.url);
        return response
    } catch (error) {
        fs.unlinkSync(file); //removes the temp file
        return null
    }
}

export { uploadToCloudinary }