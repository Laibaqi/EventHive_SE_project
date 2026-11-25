require('dotenv').config();
const app = require('./app');
const { startReminderJob } = require('./notifications/notify');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`EventHive server running on port ${PORT}`);
  startReminderJob(); // event reminder emails, every 15 minutes (Alishah)
});
