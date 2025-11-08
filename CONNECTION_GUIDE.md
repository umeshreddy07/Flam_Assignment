# How to Connect to Other People

## Local Network Connection (Same WiFi/Network)

### Option 1: Same Computer (Multiple Tabs)
1. Start the server: `npm start`
2. Open `http://localhost:3000` in multiple browser tabs
3. Each tab will be a separate user - you can see drawings from all tabs in real-time

### Option 2: Same Local Network (Different Devices)
1. **Find your computer's IP address:**
   - **Windows:** Open Command Prompt and type `ipconfig`, look for "IPv4 Address" (e.g., 192.168.1.100)
   - **Mac/Linux:** Open Terminal and type `ifconfig` or `ip addr`, look for your local IP

2. **Start the server:**
   ```bash
   npm start
   ```

3. **On the server computer:**
   - Open `http://localhost:3000` in your browser

4. **On other devices (phones, tablets, other computers on same WiFi):**
   - Open `http://YOUR_IP_ADDRESS:3000` in their browsers
   - Example: `http://192.168.1.100:3000`

5. **Important:** Make sure your firewall allows connections on port 3000

## Internet Connection (Different Networks)

To connect people from different networks, you need to:

### Option 1: Deploy to a Cloud Service
- Deploy to services like:
  - **Heroku** (free tier available)
  - **Railway** (free tier available)
  - **Render** (free tier available)
  - **DigitalOcean** (paid)
  - **AWS/Google Cloud/Azure** (paid)

Then everyone can access via the deployed URL (e.g., `https://your-app.herokuapp.com`)

### Option 2: Use ngrok (Temporary Tunnel)
1. Install ngrok: https://ngrok.com/download
2. Start your server: `npm start`
3. In a new terminal, run: `ngrok http 3000`
4. Copy the HTTPS URL ngrok provides (e.g., `https://abc123.ngrok.io`)
5. Share this URL with others - they can access your server via this URL

**Note:** Free ngrok URLs change each time you restart it.

## Troubleshooting Connection Issues

### Can't connect from other devices?
1. **Check firewall:** Make sure port 3000 is open
2. **Check IP address:** Make sure you're using the correct local IP
3. **Check network:** All devices must be on the same WiFi network
4. **Check server:** Make sure the server is running and shows "Server listening on port 3000"

### Connection works but drawings don't sync?
1. Check browser console for errors (F12 → Console tab)
2. Make sure WebSocket connection is established (check for "Connected to server" message)
3. Try refreshing the page

## Quick Test

1. Start server: `npm start`
2. Open `http://localhost:3000` in Chrome
3. Open `http://localhost:3000` in Firefox (or another browser)
4. Draw in one browser - it should appear in the other immediately!





