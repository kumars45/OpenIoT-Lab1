const axios = require('axios');
require('dotenv').config();
const net = require('net');

const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT;
const TIME_INTERVAL = process.env.TIME_INTERVAL;

function getDongles() {
  const execSync = require('child_process').execSync;
  const output = execSync('bash scdev.sh').toString();

  const dongleinfo = output.split('\n');
  var deviceList = []
  dongleinfo.pop();
  // check if dongleinfo is an array of empty strings
  if (dongleinfo.length === 1 && dongleinfo[0] === '') {
    console.log('No dongles connected')
    return [];
  }
  for (const dongle of dongleinfo) {
    var details = dongle.split(',');

    //console.log('Details:', details)
    // only puish when details is not empty
    deviceList.push({
      id: details[0],
      port: details[1]
    });
  }

  return deviceList;
}


function sendDevicesToServer() {
  setInterval(() => {
    const devices = getDongles();
    //console.log(devices)
    axios.post(`http://${SERVER_IP}:${SERVER_PORT}/api/devices`, devices)
      .then(response => {
        //console.log(response.data);
      })
      .catch(error => {
        console.error('Error:', error);
      });

    //console.log('Devices sent to server');

  }, TIME_INTERVAL);
}

sendDevicesToServer();

// export this function
module.exports = {sendDevicesToServer,getDongles};
