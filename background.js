// background.js

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'schedule_reminder') {
        handleScheduleReminder(request.data)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Will respond asynchronously
    } else if (request.action === 'sign_out') {
        handleSignOut()
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

async function handleSignOut() {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (token) {
                chrome.identity.removeCachedAuthToken({ token: token }, () => {
                    // Revoke online (optional but good)
                    fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    });
}

// Listen for alarms (Delayed Emails)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('email_reminder_')) {
        // The alarm name contains the data we need? 
        // Alarms don't store data, so we need to use Storage API or encode data in name (limited).
        // Better approach: Store the email details in chrome.storage.local using the alarm name as key.

        const alarmId = alarm.name;
        chrome.storage.local.get([alarmId], (result) => {
            const emailData = result[alarmId];
            if (emailData) {
                handleSendEmail(emailData)
                    .then(() => {
                        console.log('Delayed email sent');
                        chrome.storage.local.remove(alarmId); // Cleanup
                    })
                    .catch(err => console.error('Failed to send delayed email', err));
            }
        });
    }
});

async function getAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(token);
            }
        });
    });
}

async function handleScheduleReminder(data) {
    const { types, title, description, startTime } = data;
    const token = await getAuthToken(); // Ensure we have auth upfront

    const results = {};

    // 1. Calendar
    if (types.includes('calendar')) {
        const start = new Date(startTime);
        const end = new Date(start.getTime() + 30 * 60000);

        const event = {
            summary: title,
            description: description,
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 10 },
                    { method: 'popup', minutes: 10 },
                ],
            },
        };

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
        });

        if (!response.ok) throw new Error('Calendar API failed');
        results.calendar = 'success';
    }

    // 2. Email
    if (types.includes('email')) {
        const scheduledTime = new Date(startTime).getTime();
        const now = Date.now();

        // Construct email data
        const emailData = {
            subject: title,
            body: description
        };

        // If time is very close (within 1 min) or past, send immediately.
        // Otherwise schedule alarm.
        if (scheduledTime - now < 60000) {
            await handleSendEmail(emailData);
            results.email = 'sent_immediate';
        } else {
            // Create unique ID
            const alarmId = `email_reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Save to storage
            await chrome.storage.local.set({ [alarmId]: emailData });

            // Create Alarm
            chrome.alarms.create(alarmId, {
                when: scheduledTime
            });
            results.email = 'scheduled';
        }
    }

    return results;
}

async function handleSendEmail(data) {
    const { subject, body } = data;
    const token = await getAuthToken();

    // Construct MIME message
    const emailLines = [
        'From: "me" <me>',
        'To: me', // Send to self
        `Subject: ${subject}`,
        '',
        body
    ];
    const email = emailLines.join('\r\n').trim();

    // Base64 encode (Unicode safe)
    const base64EncodedEmail = btoa(unescape(encodeURIComponent(email)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            raw: base64EncodedEmail
        }),
    });

    if (!response.ok) {
        throw new Error(`Gmail API Error: ${response.statusText}`);
    }

    return await response.json();
}
