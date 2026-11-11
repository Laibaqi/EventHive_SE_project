// A small error type so auth code can say "stop, send this HTTP status".
// JSON is the team format: { "error": "message", "field": "fieldName" or null }.
// routes/auth.js turns it into a response; anything else goes to Zain's error handler (500).

class HttpError extends Error {
  constructor(status, message, field = null) {
    super(message);
    this.status = status;
    this.field = field;
  }

  toJSON() {
    return { error: this.message, field: this.field };
  }
}

module.exports = { HttpError };
