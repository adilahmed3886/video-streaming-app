import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";\
import jwt from "jsonwebtoken";
// import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({validateBeforeSave: false})

    return {accessToken, refreshToken}
  } catch (error) {
    throw new ApiError(500, "Failed to generate access and refresh token");
  }
}

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend / postman
  //validate the user details
  //check if user already exists? (username, email)
  //check for images and avatar
  //upload them to cloudinary, avatar
  //create user object - create entryy in DB (.create)
  //remove password and refresh token field from response
  //check for user creation (True : false)
  //return response

  const { username, email, fullName, password } = req.body;

  if (
    [username, email, fullName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existingUser = await User.findOne({
    $or: [{ username: username }, { email: email }],
  });
  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  const avatarlocalPath = req.files?.avatar[0]?.path;
  //   const coverImageLocalPath = req.files?.coverImage[0]?.path

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarlocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  const avatar = await uploadToCloudinary(avatarlocalPath);
  const coverImage = await uploadToCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar upload failed");
  }

  const user = await User.create({
    username: username.toLowerCase(),
    email: email,
    fullName: fullName,
    password: password,
    avatar: avatar.secure_url,
    coverImage: coverImage?.secure_url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Failed to create user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "user registered succeccfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //extract data from req.body
  //check if username or email exists
  //find the user connected to that email or username
  //check if password is correct
  //generate access token
  //generate refresh token
  //send tokens in cookies
  //return response

  const { username, email, password } = req.body;
  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username: username }, { email: email }],
  });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password)
  if(!isPasswordValid){
    throw new ApiError(401, "Invalid password")
  }

  const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
  if(!loggedInUser){
    throw new ApiError(500, "Failed to login user")
  }

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
          .status(200)
          .cookie("accessToken", accessToken, options)
          .cookie("refreshToken", refreshToken, options)
          .json(new ApiResponse(200, {
            user: loggedInUser,
            accessToken : accessToken,
            refreshToken : refreshToken
          }
          , "user logged in successfully"
        ));


});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: {refreshToken: undefined} },
    { new : true }
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
        .status(200)
        .clearCookie("accessToken", "", options)
        .clearCookie("refreshToken", "", options)
        .json(new ApiResponse(200, {}, "User logged out"))

});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
  if(!incomingRefreshToken){
    throw new ApiError(401, "Unauthorized request")
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    if(!decodedToken){
      throw new ApiError(401, "Invalid Refresh Token")
    }
    
    const user = await User.findById(decodedToken?._id)
    if(!user){
      throw new ApiError(401, "User not found or Invalid refresh token")
    }
  
    if(incomingRefreshToken !== user.refreshToken){
      throw new ApiError(401, "Refresh token is expired or used")
    }
  
    const options = {
      httpOnly: true,
      secure: true
    }
  
    const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
    return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200, {accessToken, newRefreshToken}, "Access token refreshed successfully"))
  
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token")
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword} = req.body;
  if (!(currentPassword || newPassword || confirmNewPassword)) {
    throw new ApiError(400, "Current password and new password are required");
  }
  if(newPassword !== confirmNewPassword){
    throw new ApiError(400, "Passwords do not match")
  }

  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(currentPassword)
  if(!isPasswordCorrect){
    throw new ApiError(400, "Invalid password")
  }

  user.password = newPassword
  await user.save({validateBeforeSave: false})

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
      .status(200)
      .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, username, email } = req.body;
  if (!(username || email || fullName)) {
    throw new ApiError(400, "Username, email and full name are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {fullName, username, email}
    },
    {new: true}
  ).select("-password")

  return  res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarPath = req.file?.path
  if(!avatarPath){
    throw new ApiError(400, "Avatar file required to update")
  }

  const avatar = await uploadToCloudinary(avatarPath)
  if(!avatar.url){
    throw new ApiError(500, "Failed to upload avatar")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {avatar: avatar.url}
    },
    {new: true}
  ).select("-password")

  return  res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"))
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImagePath = req.file?.path
  if(!coverImagePath){
    throw new ApiError(400, "Cover image file required to update")
  }

  const coverImage = await uploadToCloudinary(coverImagePath)
  if(!coverImage.url){
    throw new ApiError(500, "Failed to upload cover image")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {coverImage: coverImage.url}
    },
    {new: true}
  ).select("-password")

  return  res
    .status(200)
    .json(new ApiResponse(200, user, "coverImage updated successfully"))
});

//add user delete

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const {username} = req.params
  if(!username?.trim()){
    throw new ApiError(400, "Username is required")
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    {
      $addFields: {
        subscribersCount: {$size: "$subscribers"},
        subscribedToCount: {$size: "$subscribedTo"},
        isSubscribed: {
          $cond: {
          if: {$in: [req.user?._id, "$subscribers.subscriber"]},
          then: true,
          else: false
          }
        }
      }
    },
    {
      $project: {
        subscribersCount: 1,
        subscribedToCount: 1,
        fullName: 1,
        username: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1
      }
    }
  ])

  if(!channel?.length){
    throw new ApiError(404, "Channel not found")
  }

  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Channel fetched successfully"))
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id)
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    fullName: 1,
                    avatar: 1
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner: {
                $first: "owner"
              }
            }
          }
        ]
      }
    }
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, user[0].watchHistory, "Watch History fetched successfully"))
});

export { 
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
