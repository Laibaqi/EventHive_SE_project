// Usage: router.post('/x', validate(mySchema), handler)
// On success, req.body is replaced with the parsed (cleaned) data.
module.exports = function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.length ? issue.path.join('.') : null;
      return res.status(400).json({ error: issue.message, field });
    }
    req.body = result.data;
    next();
  };
};
