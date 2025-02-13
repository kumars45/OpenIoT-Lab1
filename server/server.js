// Import required modules
const express = require('express');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const cors = require('cors');
const axios = require('axios');
const schedule = require('node-schedule');
const FormData = require('form-data');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const unzip = require('unzip-stream');
const Busboy = require('busboy');
const { constants } = require('perf_hooks');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Constants and Configuration
const CONTIKI_DIR = '/home/iot/Desktop/contiki-ng';
const DEPLOY_DIR = `${CONTIKI_DIR}/auto-deploy`;
const SERVER_PORT = process.env.SERVER_PORT || 3000;
const CLIENT_PORT = process.env.CLIENT_PORT || 3001;

// Dynamic import for node-fetch
let fetch;
import('node-fetch').then(nodeFetch => {
  fetch = nodeFetch;
}).catch(error => console.error(`Error importing node-fetch: ${error}`));

// Import custom modules and routes
const authRoutes = require('./routes/auth');
const Device = require('./models/Device');
const Job = require('./models/Job');

// Initialize Express app and HTTP server
const app = express();
const http = require('http').Server(app);
const wss = new WebSocket.Server({ server: http });

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

// Routes
app.use('/auth', authRoutes);

// Serve login and signup pages
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/login.html'));
});

app.get('/signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/signup.html'));
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

function generateUniqueJobId(params) {
  // Combine unique parameters into a string
  const data = params.join(',');
  // Generate hash using SHA-256
  const hash = crypto.createHash('sha256').update(data).digest('hex');

  // Convert hash to a numeric value and truncate to 6 digits
  const numericValue = parseInt(hash.substring(0, 12), 16); // 12 hex characters for 6 digits
  const jobId = numericValue % 1000000; // Ensure 6 digits by taking modulo

  return jobId;
}

function scheduleJob(filePath, folderName, dfuUploadName, deviceId, jobId, duration) {
  const device = Device.findOne({ deviceId });
  clientIP = device.senderIP;
  //Make a post request to the client/deploy-code to notify the user
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  const job = Job.findOne({ jobId });
  if (job) {
    job.status = 'Running';
    job.save();
  }

  // Append other data to formData
  formData.append('folderName', folderName);
  formData.append('dfuUploadName', dfuUploadName);
  formData.append('device_id', deviceId);
  formData.append('jobId', jobId);
  formData.append('duration', duration);

  // Make a POST request using axios with FormData
  axios.post(`http://${clientIP}:${CLIENT_PORT}/deploy-code`, formData, {
    headers: {
      ...formData.getHeaders(), // Add the headers needed for FormData
    }
  }).then((response) => {
    console.log(response.data);
  }).catch((error) => {
    console.error(error);
    res.status(500).send('Error deploying code to the device!');
  });
}

app.post('/api/schedule-job', function (req, res) {
  let folderName, dfuUploadName, deviceId, duration, userId;
  const params = [new Date(), deviceId, folderName];
  const jobId = generateUniqueJobId(params);
  const bb = new Busboy({ headers: req.headers });
  let filePath = null;

  bb.on('field', (fieldname, value) => {
    if (fieldname === 'deviceId') {
      deviceId = value;
    } else if (fieldname === 'folderName') {
      folderName = value;
    } else if (fieldname === 'dfuUploadName') {
      dfuUploadName = value;
    } else if (fieldname === 'duration') {
      duration = value;
    } else if (fieldname === 'userId') {
      userId = value;
    }
  });

  bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
    console.log("filedname",fieldname)
    const jobDir = path.join(__dirname, 'temp',jobId.toString());

    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }

    filePath = path.join(jobDir, fieldname);

    file.pipe(fs.createWriteStream(filePath));
    });



  bb.on('finish', async () => {
    try {
      const device = await Device.findOne({ deviceId });
      let dateTime = device && device.freeAt ? new Date(device.freeAt) : new Date();
      dateTime.setMinutes(dateTime.getMinutes() + 1);
      
      // Have to think of the scenario when the server restarts
      schedule.scheduleJob(dateTime, function () {
        scheduleJob(filePath, folderName, dfuUploadName, deviceId, jobId, duration);
      });

      const newJob = new Job({
        jobId,
        userId,
        deviceId,
        folderName,
        dfuUploadName,
        startTime: dateTime,
        duration,
        status: 'Scheduled',
        filePath
      });

      await newJob.save();

      if (device) {
        let newDateTime = new Date(device.freeAt);
        newDateTime.setSeconds(newDateTime.getSeconds() + parseInt(duration));
        device.freeAt = newDateTime;
        await device.save();
      } else {
        const newDevice = new Device({
          deviceId,
          senderIP: req.ip,
          freeAt: dateTime.setSeconds(dateTime.getSeconds() + duration)
        });
        await newDevice.save();
      }

      res.status(200).send('Job scheduled successfully');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error scheduling job');
    }
  })

  bb.on('error', (error) => {
    console.error(error);
    res.status(500).send('Error parsing request');
  });

  req.pipe(bb);


});

app.get('/api/deviceList', async function (req, res) {
  try {
    const devices = await Device.find({});
    const deviceIds = devices.map(device => device.deviceId);
    res.json(deviceIds);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching device list');
  }
});

app.post('/api/check-availability', function (req, res) {
  // Extract node ID from request query parameters
  const deviceId = req.body.deviceId;
  const duration = req.body.duration;
  console.log("Device ID", deviceId)
  console.log("Duration", duration)

  // If nodeId is not provided, return free times for all nodes
  if (!deviceId) {
    const freeTimes = Device.find().map(device => {
      const freeTime = device && device.freeAt ? new Date(device.freeAt) : new Date();
      return { deviceId: device.deviceId, freeAt: freeTime.toLocaleString() };
    });
    return res.json(freeTimes);
  }
  
  // Return the free time for the given node ID
  const device = Device.findOne({ deviceId });
  const freeTime = device && device.freeAt ? new Date(device.freeAt) : new Date();
  return res.json({ deviceId: deviceId, freeAt: freeTime.toLocaleString() });
});


app.post('/api/get-log', function (req, res) {
  const bb = new Busboy({ headers: req.headers });
  let jobId = null;
  let files = [];

  bb.on('field', (fieldname, value) => {
    //console.log("in field /api/get-log");
    //console.log(fieldname, value)
    if (fieldname === 'jobId') {
      jobId = value;
      //console.log("inside the value update", jobId)
      // Process buffered files
      for (let file of files) {
        processFile(file);
      }
      files = [];
    }
  });

  bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
    //console.log("in file /api/get-log")

    if (jobId) {
      processFile({ fieldname, file, filename, encoding, mimetype });
    } else {
      // Buffer the file for later processing
      files.push({ fieldname, file, filename, encoding, mimetype });
    }
  });

  function processFile({ fieldname, file, filename, encoding, mimetype }) {
    const tempDir = path.join(__dirname, 'temp');
    const jobDir = path.join(tempDir, jobId);
    const logDir = path.join(jobDir, 'log');

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const filePath = path.join(logDir, filename);

    file.pipe(fs.createWriteStream(filePath));
  }

  bb.on('finish', () => {
    if (jobId === null) {
      return res.status(400).send('Job ID is required.');
    }

    const job = Job.findOne({ jobId });
    if (!job) {
      return res.status(404).send('Job ID not found.');
    }

    job.status = 'Completed';
    job.save();

    res.status(200).send('Log received and job marked as completed.');
  });

  bb.on('error', (error) => {
    console.error(error);
    res.status(500).send('Error parsing request');
  });


  req.pipe(bb);
});

app.get('/api/download-log', function (req, res) {
  const jobId = req.query.jobId;
  console.log(jobId)
  const tempDir = path.join(__dirname, 'temp');
  const jobDir = path.join(tempDir, jobId); // Append jobId to the path
  const logDir = path.join(jobDir, 'log');

  // Read the contents of the log directory
  fs.readdir(logDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read log directory.' });
    }

    // Send each file in the response
    files.forEach(file => {
      const filePath = path.join(logDir, file);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          return res.status(500).json({ error: `Failed to read file: ${file}` });
        }
        // Send the file content as response
        res.attachment(file); // Set filename in response
        res.send(data);
      });
    });
  });
});

app.get('/api/scheduled', async function (req, res) {
  try {
    const userId = req.query.userId;
    // Return scheduled and running jobs for the user
    const query = userId ? { status: { $in: ['Scheduled', 'Running'] }, userId } : { status: { $in: ['Scheduled', 'Running'] } };
    const scheduledJobs = await Job.find(query);
    res.json(scheduledJobs);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching scheduled jobs');
  }
});

app.get('/api/completed', async function (req, res) {
  try {
    const userId = req.query.userId;
    const query = userId ? { status: 'Completed', userId } : { status: 'Completed' };
    const completedJobs = await Job.find(query);
    res.json(completedJobs);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching completed jobs');
  }
});


app.post('/api/devices', async function (req, res) {
  const devices = req.body;
  const senderIP = req.ip;
  const currentTime = new Date();

  try {
    for (let device of devices) {
      let existingDevice = await Device.findOne({ deviceId: device.id });
      if (existingDevice) {
        existingDevice.senderIP = senderIP;
        if (!existingDevice.freeAt || existingDevice.freeAt < currentTime) {
          existingDevice.freeAt = currentTime;
        }
        await existingDevice.save();
      } else {
        const newDevice = new Device({
          deviceId: device.id,
          senderIP,
          freeAt: currentTime
        });
        await newDevice.save();
      }
    }
    res.send('Devices received');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing devices');
  }
});

// Recovery Mechanism
// TODO: Make a mechnaism for unfinished running jobs
async function recoverJobs() {
  const jobs = await Job.find({ status: 'Scheduled' });
  if (jobs.length === 0) {
    return;
  }
  
  jobs.forEach(job => {
    const dateTime = new Date(job.startTime);
    if (dateTime > new Date()) {
      schedule.scheduleJob(dateTime, () => {
        scheduleJob(job.filePath, job.folderName, job.dfuUploadName, job.deviceId, job.jobId, job.duration);
      });
    } else {
      // Handle jobs that should have already run but didn't due to a server restart
      scheduleJob(job.filePath, job.folderName, job.dfuUploadName, job.deviceId, job.jobId, job.duration);
    }
  });
}

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
});

http.listen(SERVER_PORT, function () {
  console.log('listening on *:', SERVER_PORT);
  recoverJobs();
});



