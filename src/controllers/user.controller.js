import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend / postman
  const {username, email, fullName, password} =  req.body
  console.log("email:", email)

  //validate the user details
  if ([username, email, fullName, password].some(field => field?.trim() === '')) {
    throw new ApiError(400, "All fields are required");
  }

  //check if user already exists? (username, email)
  const existingUser = User.findOne({$or: [{username: username}, {email: email}]})
  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  //check for images and avatar
  const avatarlocalPath = req.files?.avatar[0]?.path
  const coverImageLocalPath = req.files?.coverImage[0]?.path
  if(!avatarlocalPath){
    throw new ApiError(400, "Avatar is required")
  }

  //upload them to cloudinary, avatar
  const avatar =await uploadToCloudinary(avatarlocalPath)
  const coverImage = await uploadToCloudinary(coverImageLocalPath)
  if(!avatar){
    throw new ApiError(400, "Avatar upload failed")
  }

  //create user object - create entryy in DB (.create)
  const user = await User.create({
        username: username.toLowerCase(),
        email: email, 
        fullName: fullName, 
        password: password, 
        avatar: avatar.url, 
        coverImage: coverImage?.url || ""
    })

    //remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //check for user creation (True : false)
    if (!createdUser) {
        throw new ApiError(500, "Failed to create user");
    }
    
    //return response
    return res.status(201).json(new ApiResponse(201, createdUser, "user registered succeccfully"));
  
});

export { registerUser };