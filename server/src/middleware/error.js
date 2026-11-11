// Must keep 4 arguments so Express treats it as an error handler.
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  console.error(err); // stack stays in server logs only
  res.status(500).json({ error: 'Something went wrong', field: null });
};
