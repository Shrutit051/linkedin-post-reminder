// content.js

console.log('LinkedIn Post Reminder Content Script Loaded');

// State to track if we've already attached listeners to simplify logic
// LinkedIn is dynamic, so we need to use event delegation or MutationObserver
const OBSERVER_CONFIG = { childList: true, subtree: true };

// Specific selectors for LinkedIn actions. 
// "Save" is usually inside a dropdown menu (three dots -> Save).
// Checking for "Save" text content is more robust across class changes.

function initObserver() {
    const observer = new MutationObserver((mutations) => {
        // We'll attach a global click listener for the specific "Save" text 
        // because the menu is dynamically created when "..." is clicked.
    });
    observer.observe(document.body, OBSERVER_CONFIG);

    // Global click listener to catch "Save" clicks
    document.addEventListener('click', handleGlobalClick);
}

function handleGlobalClick(event) {
    const target = event.target;
    // Look for elements that might be the "Save" button
    // The text usually says "Save" or "Save for later"
    // We check if the target or its parent has that text

    // We need to be careful not to trigger on unsaving.
    // Usually the text toggles.
    const text = target.innerText || target.textContent;

    if (text && text.trim() === 'Save') {
        // Now we need to find the context (the post URL and preview)
        // Travels up to find the feed item container
        const postContainer = target.closest('.feed-shared-update-v2')
            || target.closest('.occludable-update');

        if (postContainer) {
            console.log('Save clicked on post:', postContainer);

            // Extract info
            // NOTE: Selectors effectively need to be verified in browser. 
            // LinkedIn classes are notoriously messy (e.g. urn:li:activity...).

            const postUrn = postContainer.getAttribute('data-urn');
            // Construct URL from URN if possible, or look for specific link
            // data-urn format: urn:li:activity:7123456...

            let postUrl = window.location.href; // Fallback
            if (postUrn) {
                const activityId = postUrn.split(':').pop();
                postUrl = `https://www.linkedin.com/feed/update/${postUrn}/`;
            }

            // Get text preview
            const textElement = postContainer.querySelector('.feed-shared-update-v2__description')
                || postContainer.querySelector('.update-components-text');
            const postText = textElement ? textElement.innerText.substring(0, 150) + "..." : "LinkedIn Post";

            showReminderModal({ url: postUrl, text: postText });
        }
    }
}

// content.js - Helper function for simplified toast
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'li-reminder-toast';
    toast.innerHTML = `
        <div class="li-toast-icon">✓</div>
        <div>${message}</div>
    `;
    document.body.appendChild(toast);

    // Remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.4s forwards';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function showReminderModal(postData) {
    // Remove existing modal if any
    const existing = document.getElementById('li-reminder-modal-overlay');
    if (existing) existing.remove();

    // Create Overlay
    const overlay = document.createElement('div');
    overlay.id = 'li-reminder-modal-overlay';
    overlay.className = 'li-reminder-modal-overlay';

    // Modal HTML
    overlay.innerHTML = `
        <div class="li-reminder-modal">
            <div class="li-reminder-header">
                <h2>Remind me to read this</h2>
                <button class="li-reminder-close">&times;</button>
            </div>
            
            <div class="li-reminder-body">
                <div class="li-reminder-content-preview">
                    <strong>Post:</strong> ${postData.text}
                </div>
                
                <div class="li-reminder-form-group">
                    <label>When should I read this?</label>
                    <input type="datetime-local" id="li-reminder-time" class="li-reminder-input">
                </div>
                
                <div class="li-reminder-form-group">
                    <label>Remind me via:</label>
                    <div class="li-reminder-checkboxes">
                         <label class="li-checkbox-label">
                            <input type="checkbox" id="li-check-calendar" checked>
                            Google Calendar
                         </label>
                         <label class="li-checkbox-label">
                            <input type="checkbox" id="li-check-email" checked>
                            Email Me
                         </label>
                    </div>
                </div>
            </div>

            <div class="li-reminder-actions">
                <button id="li-btn-schedule" class="li-reminder-btn">Schedule Reminder</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Event Listeners for Modal
    const closeBtn = overlay.querySelector('.li-reminder-close');
    closeBtn.addEventListener('click', () => overlay.remove());

    // Close on click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // Set default time (Next hour rounded up?) or just 30 mins
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30 - now.getTimezoneOffset());
    document.getElementById('li-reminder-time').value = now.toISOString().slice(0, 16);

    const btnSchedule = document.getElementById('li-btn-schedule');

    btnSchedule.addEventListener('click', () => {
        const timeVal = document.getElementById('li-reminder-time').value;
        const startTime = new Date(timeVal).toISOString();

        const useCalendar = document.getElementById('li-check-calendar').checked;
        const useEmail = document.getElementById('li-check-email').checked;

        if (!useCalendar && !useEmail) {
            alert('Please select at least one method (Calendar or Email).');
            return;
        }

        const types = [];
        if (useCalendar) types.push('calendar');
        if (useEmail) types.push('email');

        btnSchedule.innerText = 'Scheduling...';
        btnSchedule.disabled = true;

        chrome.runtime.sendMessage({
            action: 'schedule_reminder',
            data: {
                types: types,
                title: 'Read LinkedIn Post',
                description: `Read this post: ${postData.url}\n\nSnippet: ${postData.text}`,
                startTime: startTime
            }
        }, (response) => {
            btnSchedule.disabled = false;
            btnSchedule.innerText = 'Schedule Reminder';

            if (response && response.success) {
                overlay.remove();
                showToast(`Reminder set! Keep learning & growing!`);
            } else {
                alert('Failed: ' + (response?.error || 'Unknown error'));
            }
        });
    });
}

// Start
initObserver();
