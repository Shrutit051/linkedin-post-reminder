# LinkedIn Post Reminder - Setup Guide
This extension requires a Google Cloud Project to access your Calendar and Gmail. Follow these steps to set it up.

## 1. Load the Extension
Open Chrome/Edge and go to chrome://extensions. <br>
Enable Developer mode (toggle in top right).<br>
Click Load unpacked.<br>
Select the project folder in your computer <br>
Note the ID of the extension (a long string of letters, e.g., abcdefghijklmnop...). (needed later) <br>
<br>

# 2. Google Cloud Setup (One-time)
Go to the Google Cloud Console.<br>
Create a New Project (e.g., "LinkedIn Reminder"). <br>
Go to APIs & Services > Library.<br>
Search for and Enable these two APIs:<br>
Google Calendar API<br>
Gmail API<br>
Go to APIs & Services > OAuth consent screen.<br>
Select External.<br>
Fill in required fields (App Name, email).<br>
IMPORTANT: Under Test users, click Add Users and add your own Google email address. Without this, it will fail with a 403 error. <br>
Go to APIs & Services > Credentials.<br>
Click Create Credentials > OAuth client ID.<br>
Select Chrome Extension.<br>
Paste the Item ID (Extension ID) from Step 1.<br>
Click Create and copy the Client ID (ends in .apps.googleusercontent.com).<br>
# 3. Configure Extension
Open the file manifest.json file of your project <br>
Find the oauth2 section:<br>
```
"oauth2": {
  "client_id": "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
  ...
}
```
Replace YOUR_CLIENT_ID_HERE... with the Client ID you copied. <br>
Save the file.<br>
Go back to chrome://extensions and click the Refresh (circular arrow) icon on the extension card.<br>
# 4. How to Use
Go to your LinkedIn Feed.<br>
Find a post you want to read later.<br>
Click the "Save" button (usually in the ... menu on the top right of a post).<br>
A popup should appear asking "Remind me to read this".
Choose a time and click Add to Calendar or Email Me.
First run: A Google Sign-in popup will appear. Allow access.
