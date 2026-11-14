// Must keep 4 arguments so Express treats it as an error handler.
//
// Bad requests from the browser are not server faults, so they get 4xx, not 500:
//   malformed JSON body  -> 400 { error: "The request body is not valid JSON", field: null }
//   body over the limit  -> 413 { error: "The request body is too large", field: null }
// Anything unexpected is still a 500 with no details (stack stays in the server log only).
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON', field: null });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'The request body is too large', field: null });
  }
  // Other body-parser problems (wrong charset, aborted upload...) are also the client's fault.
  if (err && err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'The request could not be read', field: null });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong', field: null });
};
