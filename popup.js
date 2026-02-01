// document.getElementById('sign-out').addEventListener('click', () => {
//     const btn = document.getElementById('sign-out');
//     const msg = document.getElementById('msg');

//     btn.disabled = true;
//     btn.innerText = 'Signing Out...';

//     chrome.runtime.sendMessage({ action: 'sign_out' }, (response) => {
//         if (response && response.success) {
//             msg.innerText = 'Signed out successfully.';
//             btn.innerText = 'Sign Out';
//             btn.disabled = false;
//         } else {
//             msg.innerText = 'Error signing out.';
//             btn.disabled = false;
//         }
//     });
// });



// popup.js
const signInBtn = document.getElementById('sign-in');
const signOutBtn = document.getElementById('sign-out');
const statusEl = document.getElementById('status');
const userInfoEl = document.getElementById('user-info');
const userPic = document.getElementById('user-pic');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const remindersEl = document.getElementById('reminders');

async function updateUI() {
    statusEl.innerText = 'Checking sign-in status...';
    chrome.runtime.sendMessage({ action: 'get_user' }, (response) => {
        if (response && response.success && response.profile) {
            const p = response.profile;
            userInfoEl.style.display = 'block';
            userPic.src = p.picture || '';
            userName.innerText = p.name || 'Signed in';
            userEmail.innerText = p.email || '';
            signInBtn.style.display = 'none';
            signOutBtn.style.display = 'block';
            statusEl.innerText = 'Signed in';
        } else {
            userInfoEl.style.display = 'none';
            signInBtn.style.display = 'block';
            signOutBtn.style.display = 'none';
            statusEl.innerText = 'Not signed in';
        }
    });

    loadPendingReminders();
}

signInBtn.addEventListener('click', () => {
    signInBtn.disabled = true;
    signInBtn.innerText = 'Signing in...';
    chrome.runtime.sendMessage({ action: 'sign_in' }, (response) => {
        signInBtn.disabled = false;
        signInBtn.innerText = 'Sign In';
        if (response && response.success && response.profile) {
            updateUI();
        } else {
            statusEl.innerText = 'Sign-in failed';
        }
    });
});

signOutBtn.addEventListener('click', () => {
    signOutBtn.disabled = true;
    signOutBtn.innerText = 'Signing out...';
    chrome.runtime.sendMessage({ action: 'sign_out' }, (response) => {
        signOutBtn.disabled = false;
        signOutBtn.innerText = 'Sign Out';
        if (response && response.success) {
            updateUI();
        } else {
            statusEl.innerText = 'Error signing out.';
        }
    });
});

function formatDate(ts) {
    try {
        const d = new Date(ts);
        return d.toLocaleString();
    } catch {
        return String(ts);
    }
}

function renderReminders(list) {
    remindersEl.innerHTML = '';
    if (!list || list.length === 0) {
        const el = document.createElement('div');
        el.className = 'empty';
        el.innerText = 'No pending reminders.';
        remindersEl.appendChild(el);
        return;
    }

    for (const r of list.slice().sort((a, b) => a.scheduledTime - b.scheduledTime)) {
        const item = document.createElement('div');
        item.className = 'reminder-item';

        const left = document.createElement('div');
        left.className = 'reminder-left';
        left.innerHTML = `<div style="font-weight:600">${escapeHtml(r.title || 'Read LinkedIn Post')}</div>
                          <div class="reminder-meta">${escapeHtml((r.types || []).join(', '))} • ${formatDate(r.scheduledTime)}</div>`;

        const actions = document.createElement('div');
        actions.className = 'reminder-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = 'Cancel';
        cancelBtn.addEventListener('click', async () => {
            cancelBtn.disabled = true;
            cancelBtn.innerText = 'Cancelling...';
            chrome.runtime.sendMessage({ action: 'cancel_reminder', alarmId: r.alarmId }, (resp) => {
                if (resp && resp.success) {
                    loadPendingReminders();
                } else {
                    cancelBtn.disabled = false;
                    cancelBtn.innerText = 'Cancel';
                    statusEl.innerText = 'Failed to cancel';
                }
            });
        });

        actions.appendChild(cancelBtn);
        item.appendChild(left);
        item.appendChild(actions);
        remindersEl.appendChild(item);
    }
}

function loadPendingReminders() {
    remindersEl.innerHTML = '<div class="empty">Loading...</div>';
    chrome.runtime.sendMessage({ action: 'get_pending_reminders' }, (response) => {
        if (response && response.success) {
            renderReminders(response.reminders || []);
        } else {
            remindersEl.innerHTML = '<div class="empty">Unable to load reminders.</div>';
        }
    });
}

function escapeHtml(unsafe) {
    return (unsafe + '').replace(/[&<>"'`]/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'
    }[m]));
}

// Initialize popup UI
updateUI();