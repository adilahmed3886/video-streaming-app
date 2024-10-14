import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
  if (!username || !email) {
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

export { 
  registerUser,
  loginUser,
  logoutUser
};
