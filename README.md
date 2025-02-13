### Installation and Setup Instructions

1. **Install Dependencies**:
   - Run `npm i` in the root directory to install all the dependencies.

2. **Start Server**:
   - This can be your local machine or a remote server.
   - Navigate to the 'server' directory.
   - Run `node server.js` to start the server.

3. **Start Client**:
   - This can be your NRF dongles or other input devices.
   - Stay in the root directory.
   - Run `node client.js` to start the client.

4. **Activate Environment**:
   - Only on the client side, run `activate_env` to activate the environment.

5. **Environment Setup**:
   - Create a `.env` file in the root directory for the client.
   - Create another `.env` file in the 'master_server' directory for the server.
   - Refer to `.env.example` for an example of how to structure these files.
