const express = require('express');
const { spawn } = require('child_process');
const WebSocket = require('ws'); // Import WebSocket library
const cors = require('cors');
require('dotenv').config();
var app = express();
var http = require('http').Server(app);
const { sendDevicesToServer, getDongles } = require('./deviceSender');
const axios = require('axios');
const FormData = require('form-data');


app.use(express.static('public'));
app.use(cors());
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT

const CLIENT_PORT = process.env.CLIENT_PORT;
const fs = require('fs'); // Import file system module
const path = require('path'); // Import path module for handling file paths
const unzip = require('unzip-stream'); // Import unzip library
const Busboy = require('busboy') // Import busboy library for parsing multipart form data
const execSync = require('child_process').execSync;

const CONTIKI_DIR = '/home/iot/Desktop/contiki-ng';
const DEPLOY_DIR = `${CONTIKI_DIR}/auto-deploy`;

app.post('/deploy-code', function (req, res) {
  const bb = new Busboy({ headers: req.headers });
  let device_id = null;
  let folderName = null;
  let dfuUploadName = null;
  let duration = null;
  let jobId = null

  let filePath = null;
  let tempDir = null;
  let deployDir = null;

  bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
    if (!fs.existsSync(path.join(__dirname, 'temp'))) {
      fs.mkdirSync(path.join(__dirname, 'temp'));
    }
    tempDir = path.join(__dirname, 'temp');
    filePath = path.join(tempDir, filename);
    file.pipe(fs.createWriteStream(filePath));
  });
  bb.on('field', (fieldname, value) => {
    if (fieldname === 'device_id') {
      device_id = value;
    } else if (fieldname === 'folderName') {
      folderName = value;
    } else if (fieldname === 'dfuUploadName') {
      dfuUploadName = value;
    }
    else if (fieldname === 'duration') {
      duration = value;
    }
    else if (fieldname === 'jobId') {
      jobId = value;
    }
  });
  bb.on('finish', () => {
    deployDir = path.join(DEPLOY_DIR, jobId);
    if (!fs.existsSync(deployDir)) {
      fs.mkdirSync(deployDir, { recursive: true });
    }

    fs.createReadStream(filePath)
      .pipe(unzip.Extract({ path: deployDir })) // Extract to target path
      .on('finish', () => {
        // Delete temporary directory and uploaded file
        fs.rmSync(tempDir, { recursive: true });
        // res.send('Code uploaded and extracted successfully!');
        const dongle_list = getDongles();
        const dongle = dongle_list.find(d => d.id.includes(device_id));
        const port = dongle ? dongle.port : null;

        const deployProcess = spawn('make', [
          '-C', `${deployDir}/${folderName}`,
          'TARGET=nrf52840',
          'BOARD=dongle',
          `${dfuUploadName}.dfu-upload`,
          `PORT=${port}`]
        );

        deployProcess.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);
        });

        deployProcess.stderr.on('data', (data) => {
          console.error(`stderr: ${data}`);
          res.status(500).send('Deployment was unsuccessful');
        });

        deployProcess.on('close', (code) => {
          if (code === 0) {
            // res.send('Code upload successful!');
            console.log('Code upload successful')
            setTimeout(() => {

              const logFile = `${deployDir}/log.txt`
              const logProcess = spawn('bash', ['log_command.sh', duration, port, logFile], {
                detached: true
              })
              console.log('Started logging')
              logProcess.on('error', (error) => {
                console.error(`Error while logging: ${error}`);
                res.status(500).send('Error while logging');
              });
              logProcess.on('close', (code) => {
                  // Send log file to server
                  let formData = new FormData();
                  formData.append('log', fs.createReadStream(`${deployDir}/log.txt`));
                  formData.append('jobId', jobId);
                  axios.post(`http://${SERVER_IP}:${SERVER_PORT}/api/get-log`, formData)
                    .then((response) => {
                      console.log('Log file sent successfully');
                      // res.send("Done");
                    })
                    .catch((error) => {
                      console.error('Error sending log file:', error);
                      // res.send("Not sent")
                    });
              });
              res.send('Process deployed and logging started');
            }, 5000); // Delay of 5 seconds

          } else {
            res.status(500).send('Error uploading code!');
          }
        });
      })
      .on('error', (error) => {
          console.error(error);
          fs.rmSync(tempDir, { recursive: true }); // Cleanup on error
          res.status(500).send('Error unzipping code!');
        });

      });
    bb.on('error', (error) => {
      console.error(error);
      res.status(500).send('Error parsing request');
    });

    req.pipe(bb);
  });


  http.listen(CLIENT_PORT, function () {
    console.log("listening on *:", CLIENT_PORT);
  });



  sendDevicesToServer()