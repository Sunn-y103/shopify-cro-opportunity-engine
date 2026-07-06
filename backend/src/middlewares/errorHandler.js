export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    status: 'error',
    message: err.message,
    // Only include stack trace in development mode
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
  });
};
