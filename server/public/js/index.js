const folderName = document.getElementById('folder-name');
const dfuUploadName = document.getElementById('dfu-upload-name');
const deviceId = document.getElementById('device-id');
const duration = document.getElementById('duration');
const codeFile = document.getElementById('code-file');
const scheduleJobButton = document.getElementById('schedule-job');
// const downloadLogButton = document.getElementsByClassName('download-log')

const deviceIdAvailability = document.getElementById('device-id-availability')
const durationAvailabiltiy = document.getElementById('duration-availability')
const availability = document.getElementById('availability')
const checkAvailability = document.getElementById('check-availability')
const logoutButton = document.getElementById('logout-button');

function fetchAndPopulateDongles() {
    // Assuming you are serving your HTML from the same domain as your API
    fetch('http://localhost:3000/api/deviceList')
        .then(response => {
            console.log("Response: ", response)
            return response.json()
        }) // Convert the response to JSON
        .then(data => {
            console.log("Data: ", data)
            if (!data.length) {
                alert('No dongles available');
                return;
            }
            // Get the table's tbody element
            const tableBody = document.getElementById('deviceTable').getElementsByTagName('tbody')[0];

            // Clear existing table rows
            tableBody.innerHTML = '';

            // Iterate over each dongle and add a row to the table
            data.forEach((dongle, index) => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${dongle}</td>
                    <td>Fixed</td>
                `;
            });
        })
        .catch(error => console.error('Error fetching dongles:', error));
}

function getScheduledJobs(userId) {
    fetch(`http://localhost:3000/api/scheduled?userId=${userId}`)
        .then(response => response.json())
        .then(data => {
            console.log("Data: ", data);
            const tableBody = document.getElementById('scheduledJobsTable').getElementsByTagName('tbody')[0];
            tableBody.innerHTML = '';

            let index = 0;
            for (let key in data) {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${key}</td>
                    <td>${data[key].deviceId}</td>
                    <td>${data[key].status}</td>
                    <td>${new Date(data[key].startTime).toLocaleString()}</td>
                    <td>${data[key].duration}</td>
                `;
                index++;
            };
        })
        .catch(error => console.error('Error fetching jobs:', error));
}

function getFinishedJobs(userId) {
    return new Promise((resolve, reject) => {
        fetch(`http://localhost:3000/api/completed?userId=${userId}`)
            .then(response => response.json())
            .then(data => {
                console.log("Data: ", data);
                const tableBody = document.getElementById('finishedJobsTable').getElementsByTagName('tbody')[0];
                tableBody.innerHTML = '';

                let index = 0;
                for (let key in data) {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${key}</td>
                        <td>${data[key].deviceId}</td>
                        <td>${new Date(data[key].startTime).toLocaleString()}</td>
                        <td>${data[key].duration}</td>
                        <td><button class='download-log' data-key='${key}'>Download Log</button></td>
                    `;
                    index++;
                };

                resolve(); // Resolve the promise after the DOM manipulation is complete
            })
            .catch(error => {
                console.error('Error fetching jobs:', error);
                reject(error); // Reject the promise if there's an error
            });
    });
}

scheduleJobButton.addEventListener('click', () => {
    // Create a new FormData object
    console.log("Have been hit",typeof(codeFile))
    const formData = new FormData();
    const userId = localStorage.getItem('userId')

    // Append the form data
    formData.append('folderName', folderName.value);
    formData.append('dfuUploadName', dfuUploadName.value);
    formData.append('deviceId', deviceId.value);
    formData.append('duration', duration.value);
    formData.append('code', codeFile.files[0]);
    formData.append('userId', userId);
    // Send the form data to the server
    fetch('http://localhost:3000/api/schedule-job', {
        method: 'POST',
        body: formData
    })
        .then(response => response.text())
        .then(message => {
            alert(message);
            getScheduledJobs();
        })
        .catch(error => console.error('Error scheduling job:', error));
});

logoutButton.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    window.location.href = '/login.html';
});

const downloadLogButton =  (jobId) => {
    console.log("Have been hit")
    fetch(`http://localhost:3000/api/download-log?jobId=${jobId}`)
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `log-${jobId}.txt`;
            a.click();
        })
        .catch(error => console.error('Error downloading log:', error));
};

checkAvailability.addEventListener('click', () => {
    // Send device id availability and duration availability to the server
    fetch('http://localhost:3000/api/check-availability', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            deviceId: deviceIdAvailability.value,
            duration: durationAvailabiltiy.value
        })
    })
        .then(response => response.json())
        .then(data => {
            console.log("this is in /api/check-availability", data)
            availability.innerHTML = data.freeAt;
        })
        .catch(error => console.error('Error checking availability:', error));
});


// Call the function when the page has finished loading
document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    fetchAndPopulateDongles();
    getScheduledJobs(userId);
    getFinishedJobs(userId).then(()=>{
        console.log('getFinishedJobs completed');
    
        const buttons = document.querySelectorAll('.download-log');
        console.log(`Found ${buttons.length} buttons`);
    
        buttons.forEach(button => {
            console.log(button);
    
            button.addEventListener('click', (event) => {
                const key = event.target.getAttribute('data-key');
                console.log(`Button clicked, key: ${key}`);
    
                downloadLogButton(key);
            });
        });
    });
})

const token = localStorage.getItem('token');
const authButtons = document.getElementById('auth-buttons');
const content = document.getElementById('content');

if (token) {
  authButtons.style.display = 'none';
  // You can now fetch protected resources
  fetchAndPopulateDongles();
} else {
  content.innerHTML = '<p>Please <a href="/login.html">login</a> or <a href="/signup.html">signup</a>.</p>';
}