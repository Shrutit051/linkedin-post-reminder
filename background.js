// background.js
// Handles auth, scheduling (calendar + email), alarms, retries/backoff, logging, and reminder management.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        try {
            switch (request.action) {
                case 'schedule_reminder':
                    sendResponse({ success: true, data: await handleScheduleReminder(request.data) });
                    break;
                case 'sign_out':
                    await handleSignOut();
                    sendResponse({ success: true });
                    break;
                case 'sign_in':
                    sendResponse({ success: true, profile: await handleSignIn() });
                    break;
                case 'get_user':
                    sendResponse({ success: true, profile: await handleGetUser() });
                    break;
                case 'get_pending_reminders':
                    sendResponse({ success: true, reminders: await getScheduledReminders() });
                    break;
                case 'cancel_reminder':
                    await cancelReminder(request.alarmId);
                    sendResponse({ success: true });
                    break;
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (err) {
            sendResponse({ success: false, error: err && err.message ? err.message : String(err) });
        }
    })();
    return true;
});

////////////////////////////////////////////////////////////////////////////////
// Auth helpers
////////////////////////////////////////////////////////////////////////////////
async function getAuthToken({ interactive = true } = {}) {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
            }
            resolve(token);
        });
    });
}

async function fetchUserInfo(token) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch user info');
    return await res.json();
}

async function handleSignIn() {
    const token = await getAuthToken({ interactive: true });
    if (!token) throw new Error('No token received during sign-in');
    const profile = await fetchUserInfo(token);
    await chrome.storage.local.set({ user_profile: profile });
    return profile;
}

async function handleGetUser() {
    try {
        const token = await getAuthToken({ interactive: false });
        if (!token) return null;
        const profile = await fetchUserInfo(token);
        await chrome.storage.local.set({ user_profile: profile });
        return profile;
    } catch {
        const stored = await new Promise(res => chrome.storage.local.get(['user_profile'], (r) => res(r.user_profile || null)));
        return stored;
    }
}

async function handleSignOut() {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (chrome.runtime.lastError || !token) {
                chrome.storage.local.remove(['user_profile']).finally(() => resolve());
            } else {
                chrome.identity.removeCachedAuthToken({ token }, () => {
                    fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => { });
                    chrome.storage.local.remove(['user_profile']).finally(() => resolve());
                });
            }
        });
    });
}

////////////////////////////////////////////////////////////////////////////////
// Scheduled reminders management (stored list)
// We'll keep a scheduled_reminders array in chrome.storage.local for listing & cancellation.
////////////////////////////////////////////////////////////////////////////////
async function getStorage(key) {
    return new Promise(res => chrome.storage.local.get([key], (r) => res(r[key])));
}

async function setStorage(obj) {
    return new Promise(res => chrome.storage.local.set(obj, () => res()));
}

async function getScheduledReminders() {
    const list = await getStorage('scheduled_reminders');
    return list || [];
}

async function saveScheduledReminder(entry) {
    const list = await getScheduledReminders();
    list.push(entry);
    await setStorage({ scheduled_reminders: list });
}

async function removeScheduledReminder(alarmId) {
    const list = await getScheduledReminders();
    const filtered = list.filter(r => r.alarmId !== alarmId);
    await setStorage({ scheduled_reminders: filtered });
}

async function logError(entry) {
    const logs = await getStorage('error_logs') || [];
    logs.push(entry);
    await setStorage({ error_logs: logs });
}

////////////////////////////////////////////////////////////////////////////////
// Retry/backoff helper
////////////////////////////////////////////////////////////////////////////////
async function withRetry(fn, { retries = 3, initialDelayMs = 1000, operation = 'op' } = {}) {
    let attempt = 0;
    let delay = initialDelayMs;
    while (attempt < retries) {
        try {
            attempt++;
            return await fn();
        } catch (err) {
            // On final attempt, log and rethrow
            if (attempt >= retries) {
                const msg = {
                    time: new Date().toISOString(),
                    operation,
                    attempts: attempt,
                    error: err && err.message ? err.message : String(err)
                };
                await logError(msg);
                throw err;
            }
            // Wait exponential backoff then retry
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////
// Calendar & Gmail API wrappers (with retry)
////////////////////////////////////////////////////////////////////////////////
async function createCalendarEvent(token, event) {
    return await withRetry(async () => {
        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error('Calendar API failed: ' + (text || res.statusText));
        }
        return await res.json();
    }, { retries: 3, initialDelayMs: 1000, operation: 'createCalendarEvent' });
}

async function sendGmailRaw(token, rawEmail) {
    return await withRetry(async () => {
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw: rawEmail }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error('Gmail API Error: ' + (text || res.statusText));
        }
        return await res.json();
    }, { retries: 3, initialDelayMs: 1000, operation: 'sendGmailRaw' });
}

////////////////////////////////////////////////////////////////////////////////
// Scheduling & sending logic
////////////////////////////////////////////////////////////////////////////////
async function handleScheduleReminder(data) {
    const { types, title, description, startTime } = data;
    const results = {};

    // Calendar handling (immediate creation)
    if (types.includes('calendar')) {
        const token = await getAuthToken({ interactive: true });
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

        await createCalendarEvent(token, event);
        results.calendar = 'created';
    }

    // Email handling (may be scheduled)
    if (types.includes('email')) {
        const scheduledTime = new Date(startTime).getTime();
        const now = Date.now();

        const emailData = {
            subject: title,
            body: description
        };

        if (scheduledTime - now < 60000) {
            // Immediate send
            await sendEmailNow(emailData);
            results.email = 'sent_immediate';
        } else {
            const alarmId = `email_reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Save the payload under a storage key too (for the alarm handler)
            await setStorage({ [alarmId]: emailData });

            // Create chrome alarm
            chrome.alarms.create(alarmId, { when: scheduledTime });

            // Save a pending reminder entry for popup listing
            await saveScheduledReminder({
                alarmId,
                types,
                title,
                description,
                scheduledTime,
                createdAt: Date.now()
            });

            results.email = { scheduled: true, alarmId };
        }
    }

    return results;
}

async function sendEmailNow(emailData) {
    const token = await getAuthToken({ interactive: false }).catch(async () => await getAuthToken({ interactive: true }));
    if (!token) throw new Error('Not authenticated to send email');
    const profile = await fetchUserInfo(token);
    const toEmail = profile.email;
    const fromName = profile.name || 'Me';

    const emailLines = [
        `From: ${fromName} <${toEmail}>`,
        `To: ${toEmail}`,
        `Subject: ${emailData.subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        emailData.body
    ];
    const email = emailLines.join('\r\n');

    const base64EncodedEmail = btoa(unescape(encodeURIComponent(email)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    await sendGmailRaw(token, base64EncodedEmail);
}

////////////////////////////////////////////////////////////////////////////////
// Alarm listener: fires scheduled emails
////////////////////////////////////////////////////////////////////////////////
chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm || !alarm.name) return;
    if (alarm.name.startsWith('email_reminder_')) {
        const alarmId = alarm.name;
        chrome.storage.local.get([alarmId], async (result) => {
            const emailData = result[alarmId];
            if (!emailData) {
                // If missing payload, log and remove scheduled_reminders entry
                await logError({ time: new Date().toISOString(), operation: 'alarm_no_payload', alarmId });
                await removeScheduledReminder(alarmId);
                return;
            }

            try {
                // Attempt to send with retry/backoff
                await sendEmailNow(emailData);

                // Cleanup stored payload & scheduled_reminders
                chrome.storage.local.remove(alarmId);
                await removeScheduledReminder(alarmId);
            } catch (err) {
                // If send failed despite retries, we already logged in withRetry.
                // Also remove pending entry so popup doesn't show it as pending forever.
                await removeScheduledReminder(alarmId);
                // Keep the payload in storage for diagnostics if desired (or remove)
                // We'll leave payload for debugging but you can remove it:
                // chrome.storage.local.remove(alarmId);
            }
        });
    }
});

////////////////////////////////////////////////////////////////////////////////
// Cancel reminder (from popup)
////////////////////////////////////////////////////////////////////////////////
async function cancelReminder(alarmId) {
    return new Promise((resolve) => {
        chrome.alarms.clear(alarmId, async (wasCleared) => {
            try {
                await removeScheduledReminder(alarmId);
                // remove stored payload as well
                chrome.storage.local.remove(alarmId, () => resolve());
            } catch {
                resolve();
            }
        });
    });
}

// // background.js

// // Listen for messages from content script or popup
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.action === 'schedule_reminder') {
//         handleScheduleReminder(request.data)
//             .then(response => sendResponse({ success: true, data: response }))
//             .catch(error => sendResponse({ success: false, error: error.message }));
//         return true; // Will respond asynchronously
//     } else if (request.action === 'sign_out') {
//         handleSignOut()
//             .then(() => sendResponse({ success: true }))
//             .catch(error => sendResponse({ success: false, error: error.message }));
//         return true;
//     }
// });

// async function handleSignOut() {
//     return new Promise((resolve) => {
//         chrome.identity.getAuthToken({ interactive: false }, (token) => {
//             if (token) {
//                 chrome.identity.removeCachedAuthToken({ token: token }, () => {
//                     // Revoke online (optional but good)
//                     fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
//                     resolve();
//                 });
//             } else {
//                 resolve();
//             }
//         });
//     });
// }

// // Listen for alarms (Delayed Emails)
// chrome.alarms.onAlarm.addListener((alarm) => {
//     if (alarm.name.startsWith('email_reminder_')) {
//         // The alarm name contains the data we need?
//         // Alarms don't store data, so we need to use Storage API or encode data in name (limited).
//         // Better approach: Store the email details in chrome.storage.local using the alarm name as key.

//         const alarmId = alarm.name;
//         chrome.storage.local.get([alarmId], (result) => {
//             const emailData = result[alarmId];
//             if (emailData) {
//                 handleSendEmail(emailData)
//                     .then(() => {
//                         console.log('Delayed email sent');
//                         chrome.storage.local.remove(alarmId); // Cleanup
//                     })
//                     .catch(err => console.error('Failed to send delayed email', err));
//             }
//         });
//     }
// });

// async function getAuthToken() {
//     return new Promise((resolve, reject) => {
//         chrome.identity.getAuthToken({ interactive: true }, (token) => {
//             if (chrome.runtime.lastError) {
//                 reject(chrome.runtime.lastError);
//             } else {
//                 resolve(token);
//             }
//         });
//     });
// }

// async function handleScheduleReminder(data) {
//     const { types, title, description, startTime } = data;
//     const token = await getAuthToken(); // Ensure we have auth upfront

//     const results = {};

//     // 1. Calendar
//     if (types.includes('calendar')) {
//         const start = new Date(startTime);
//         const end = new Date(start.getTime() + 30 * 60000);

//         const event = {
//             summary: title,
//             description: description,
//             start: { dateTime: start.toISOString() },
//             end: { dateTime: end.toISOString() },
//             reminders: {
//                 useDefault: false,
//                 overrides: [
//                     { method: 'email', minutes: 10 },
//                     { method: 'popup', minutes: 10 },
//                 ],
//             },
//         };

//         const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
//             method: 'POST',
//             headers: {
//                 'Authorization': `Bearer ${token}`,
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify(event),
//         });

//         if (!response.ok) throw new Error('Calendar API failed');
//         results.calendar = 'success';
//     }

//     // 2. Email
//     if (types.includes('email')) {
//         const scheduledTime = new Date(startTime).getTime();
//         const now = Date.now();

//         // Construct email data
//         const emailData = {
//             subject: title,
//             body: description
//         };

//         // If time is very close (within 1 min) or past, send immediately.
//         // Otherwise schedule alarm.
//         if (scheduledTime - now < 60000) {
//             await handleSendEmail(emailData);
//             results.email = 'sent_immediate';
//         } else {
//             // Create unique ID
//             const alarmId = `email_reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

//             // Save to storage
//             await chrome.storage.local.set({ [alarmId]: emailData });

//             // Create Alarm
//             chrome.alarms.create(alarmId, {
//                 when: scheduledTime
//             });
//             results.email = 'scheduled';
//         }
//     }

//     return results;
// }

// async function handleSendEmail(data) {
//     const { subject, body } = data;
//     const token = await getAuthToken();

//     // Construct MIME message
//     const emailLines = [
//         'From: "me" <me>',
//         'To: me', // Send to self
//         `Subject: ${subject}`,
//         '',
//         body
//     ];
//     const email = emailLines.join('\r\n').trim();

//     // Base64 encode (Unicode safe)
//     const base64EncodedEmail = btoa(unescape(encodeURIComponent(email)))
//         .replace(/\+/g, '-')
//         .replace(/\//g, '_')
//         .replace(/=+$/, '');

//     const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
//         method: 'POST',
//         headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//             raw: base64EncodedEmail
//         }),
//     });

//     if (!response.ok) {
//         throw new Error(`Gmail API Error: ${response.statusText}`);
//     }

//     return await response.json();
// }
