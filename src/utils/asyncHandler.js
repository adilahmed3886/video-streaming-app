//method no 1:

const asyncHandler = (requestHandler) => {
    (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
        .catch(error => next(error))
    }
}

export { asyncHandler }

//method no 2:

// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         req.status(err.code || 500).json({
//             success: false,
//             message: err.message || 'Internal Server Error',
//         })
//     }
// }