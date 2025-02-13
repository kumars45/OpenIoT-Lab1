const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobId: { type: Number, unique: true },
  userId: String, 
  deviceId: String,
  folderName: String,
  dfuUploadName: String,
  startTime: Date,
  duration: Number,
  status: String,
  filePath: String
});

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
