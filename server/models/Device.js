const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, unique: true },
  senderIP: String,
  freeAt: Date
});

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
