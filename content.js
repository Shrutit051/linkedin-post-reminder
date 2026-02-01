// // content.js

// console.log('LinkedIn Post Reminder Content Script Loaded');

// // State to track if we've already attached listeners to simplify logic
// // LinkedIn is dynamic, so we need to use event delegation or MutationObserver
// const OBSERVER_CONFIG = { childList: true, subtree: true };

// // Specific selectors for LinkedIn actions. 
// // "Save" is usually inside a dropdown menu (three dots -> Save).
// // Checking for "Save" text content is more robust across class changes.

// function initObserver() {
//     const observer = new MutationObserver((mutations) => {
//         // We'll attach a global click listener for the specific "Save" text 
//         // because the menu is dynamically created when "..." is clicked.
//     });
//     observer.observe(document.body, OBSERVER_CONFIG);

//     // Global click listener to catch "Save" clicks
//     document.addEventListener('click', handleGlobalClick);
// }

// function handleGlobalClick(event) {
//     const target = event.target;
//     // Look for elements that might be the "Save" button
//     // The text usually says "Save" or "Save for later"
//     // We check if the target or its parent has that text

//     // We need to be careful not to trigger on unsaving.
//     // Usually the text toggles.
//     const text = target.innerText || target.textContent;

//     if (text && text.trim() === 'Save') {
//         // Now we need to find the context (the post URL and preview)
//         // Travels up to find the feed item container
//         const postContainer = target.closest('.feed-shared-update-v2')
//             || target.closest('.occludable-update');

//         if (postContainer) {
//             console.log('Save clicked on post:', postContainer);

//             // Extract info
//             // NOTE: Selectors effectively need to be verified in browser. 
//             // LinkedIn classes are notoriously messy (e.g. urn:li:activity...).

//             const postUrn = postContainer.getAttribute('data-urn');
//             // Construct URL from URN if possible, or look for specific link
//             // data-urn format: urn:li:activity:7123456...

//             let postUrl = window.location.href; // Fallback
//             if (postUrn) {
//                 const activityId = postUrn.split(':').pop();
//                 postUrl = `https://www.linkedin.com/feed/update/${postUrn}/`;
//             }

//             // Get text preview
//             const textElement = postContainer.querySelector('.feed-shared-update-v2__description')
//                 || postContainer.querySelector('.update-components-text');
//             const postText = textElement ? textElement.innerText.substring(0, 150) + "..." : "LinkedIn Post";

//             showReminderModal({ url: postUrl, text: postText });
//         }
//     }
// }

// // content.js - Helper function for simplified toast
// function showToast(message) {
//     const toast = document.createElement('div');
//     toast.className = 'li-reminder-toast';
//     toast.innerHTML = `
//         <div class="li-toast-icon">✓</div>
//         <div>${message}</div>
//     `;
//     document.body.appendChild(toast);

//     // Remove after 4 seconds
//     setTimeout(() => {
//         toast.style.animation = 'toastFadeOut 0.4s forwards';
//         setTimeout(() => toast.remove(), 400);
//     }, 4000);
// }

// function showReminderModal(postData) {
//     // Remove existing modal if any
//     const existing = document.getElementById('li-reminder-modal-overlay');
//     if (existing) existing.remove();

//     // Create Overlay
//     const overlay = document.createElement('div');
//     overlay.id = 'li-reminder-modal-overlay';
//     overlay.className = 'li-reminder-modal-overlay';

//     // Modal HTML
//     overlay.innerHTML = `
//         <div class="li-reminder-modal">
//             <div class="li-reminder-header">
//                 <h2>Remind me to read this</h2>
//                 <button class="li-reminder-close">&times;</button>
//             </div>

//             <div class="li-reminder-body">
//                 <div class="li-reminder-content-preview">
//                     <strong>Post:</strong> ${postData.text}
//                 </div>

//                 <div class="li-reminder-form-group">
//                     <label>When should I read this?</label>
//                     <input type="datetime-local" id="li-reminder-time" class="li-reminder-input">
//                 </div>

//                 <div class="li-reminder-form-group">
//                     <label>Remind me via:</label>
//                     <div class="li-reminder-checkboxes">
//                          <label class="li-checkbox-label">
//                             <input type="checkbox" id="li-check-calendar" checked>
//                             Google Calendar
//                          </label>
//                          <label class="li-checkbox-label">
//                             <input type="checkbox" id="li-check-email" checked>
//                             Email Me
//                          </label>
//                     </div>
//                 </div>
//             </div>

//             <div class="li-reminder-actions">
//                 <button id="li-btn-schedule" class="li-reminder-btn">Schedule Reminder</button>
//             </div>
//         </div>
//     `;

//     document.body.appendChild(overlay);

//     // Event Listeners for Modal
//     const closeBtn = overlay.querySelector('.li-reminder-close');
//     closeBtn.addEventListener('click', () => overlay.remove());

//     // Close on click outside
//     overlay.addEventListener('click', (e) => {
//         if (e.target === overlay) overlay.remove();
//     });

//     // Set default time (Next hour rounded up?) or just 30 mins
//     const now = new Date();
//     now.setMinutes(now.getMinutes() + 30 - now.getTimezoneOffset());
//     document.getElementById('li-reminder-time').value = now.toISOString().slice(0, 16);

//     const btnSchedule = document.getElementById('li-btn-schedule');

//     btnSchedule.addEventListener('click', () => {
//         const timeVal = document.getElementById('li-reminder-time').value;
//         const startTime = new Date(timeVal).toISOString();

//         const useCalendar = document.getElementById('li-check-calendar').checked;
//         const useEmail = document.getElementById('li-check-email').checked;

//         if (!useCalendar && !useEmail) {
//             alert('Please select at least one method (Calendar or Email).');
//             return;
//         }

//         const types = [];
//         if (useCalendar) types.push('calendar');
//         if (useEmail) types.push('email');

//         btnSchedule.innerText = 'Scheduling...';
//         btnSchedule.disabled = true;

//         chrome.runtime.sendMessage({
//             action: 'schedule_reminder',
//             data: {
//                 types: types,
//                 title: 'Read LinkedIn Post',
//                 description: `Read this post: ${postData.url}\n\nSnippet: ${postData.text}`,
//                 startTime: startTime
//             }
//         }, (response) => {
//             btnSchedule.disabled = false;
//             btnSchedule.innerText = 'Schedule Reminder';

//             if (response && response.success) {
//                 overlay.remove();
//                 showToast(`Reminder set! Keep learning & growing!`);
//             } else {
//                 alert('Failed: ' + (response?.error || 'Unknown error'));
//             }
//         });
//     });
// }

// // Start
// initObserver();



// content.js
// Improved Save detection using MutationObserver + safer click handling

console.log('LinkedIn Post Reminder Content Script Loaded');

const OBSERVER_CONFIG = { childList: true, subtree: true };

// Track menus we've attached listeners to (avoid duplicates)
const attachedMenus = new WeakSet();

function initObserver() {
    // Listen for clicks globally as a fallback
    document.addEventListener('click', handleGlobalClick, true);

    // Observe DOM for dropdown/menu nodes that LinkedIn injects
    const observer = new MutationObserver(onMutations);
    observer.observe(document.body, OBSERVER_CONFIG);
}

function onMutations(mutations) {
    for (const m of mutations) {
        for (const node of m.addedNodes) {
            try {
                if (!(node instanceof HTMLElement)) continue;
                // Many LinkedIn dropdowns use the class 'artdeco-dropdown__content' or role="menu"
                if (node.matches && (node.matches('.artdeco-dropdown__content') || node.getAttribute('role') === 'menu' || node.querySelector && node.querySelector('.artdeco-dropdown__content'))) {
                    attachMenuListener(node);
                }
                // Also scan descendants for matching nodes
                const menus = node.querySelectorAll ? node.querySelectorAll('.artdeco-dropdown__content, [role="menu"]') : [];
                for (const mnode of menus) attachMenuListener(mnode);
            } catch (err) {
                /* ignore DOM exceptions */
            }
        }
    }
}

function attachMenuListener(node) {
    if (attachedMenus.has(node)) return;
    attachedMenus.add(node);
    node.addEventListener('click', (e) => {
        const target = e.target;
        // The "Save" menu item often has text 'Save' or 'Save for later'
        const txt = (target.innerText || target.textContent || '').trim();
        if (txt === 'Save' || txt === 'Save for later') {
            // Try to find post container from nearest ancestor or current page context
            const postContainer = findPostContainerForMenu(node) || target.closest('article');
            if (postContainer) handleSaveClickFor(postContainer);
        }
    }, true);
}

function handleGlobalClick(event) {
    const target = event.target;
    const text = (target.innerText || target.textContent || '').trim();
    if (!text) return;

    // Direct click fallback (in case menu listener wasn't attached)
    if (text === 'Save' || text === 'Save for later') {
        const postContainer = target.closest('.feed-shared-update-v2')
            || target.closest('.occludable-update')
            || target.closest('article');
        if (postContainer) handleSaveClickFor(postContainer);
    }
}

function findPostContainerForMenu(menuNode) {
    // Walk up enough parents to find an article or feed item
    let el = menuNode;
    for (let i = 0; i < 8 && el; i++) {
        el = el.parentElement;
        if (!el) break;
        if (el.matches && (el.matches('article') || el.matches('.feed-shared-update-v2') || el.matches('.occludable-update'))) return el;
    }
    // fallback: query nearest article on the page that is visible
    const articles = document.querySelectorAll('article');
    for (const a of articles) {
        if (a.contains(menuNode)) return a;
    }
    return null;
}

function handleSaveClickFor(postContainer) {
    if (!postContainer) return;
    const postUrn = postContainer.getAttribute('data-urn');
    let postUrl = window.location.href;
    if (postUrn) postUrl = `https://www.linkedin.com/feed/update/${postUrn}/`;
    else {
        const link = postContainer.querySelector('a[href*="/posts/"], a[href*="/feed/update/"], a[data-control-name="comment"]');
        if (link && link.href) postUrl = link.href;
    }

    const textElement = postContainer.querySelector('.feed-shared-update-v2__description')
        || postContainer.querySelector('.update-components-text')
        || postContainer.querySelector('p');
    let postText = textElement ? textElement.innerText.trim() : 'LinkedIn Post';
    if (postText.length > 200) postText = postText.slice(0, 200) + '...';

    showReminderModal({ url: postUrl, text: postText });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'li-reminder-toast';
    toast.innerHTML = `<div class="li-toast-icon">✓</div><div>${message}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.4s forwards';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function toLocalDatetimeInputValue(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function showReminderModal(postData) {
    const existing = document.getElementById('li-reminder-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'li-reminder-modal-overlay';
    overlay.className = 'li-reminder-modal-overlay';

    overlay.innerHTML = `
        <div class="li-reminder-modal">
            <div class="li-reminder-header">
                <h2>Remind me to read this</h2>
                <button class="li-reminder-close" aria-label="Close">&times;</button>
            </div>
            <div class="li-reminder-body">
                <div class="li-reminder-content-preview"><strong>Post:</strong> ${escapeHtml(postData.text)}</div>
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

    const closeBtn = overlay.querySelector('.li-reminder-close');
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const now = new Date(Date.now() + 30 * 60000);
    document.getElementById('li-reminder-time').value = toLocalDatetimeInputValue(now);

    const btnSchedule = document.getElementById('li-btn-schedule');
    btnSchedule.addEventListener('click', () => {
        const timeVal = document.getElementById('li-reminder-time').value;
        if (!timeVal) { alert('Please select a date and time.'); return; }
        const localDate = new Date(timeVal);
        const startTime = localDate.toISOString();

        const useCalendar = document.getElementById('li-check-calendar').checked;
        const useEmail = document.getElementById('li-check-email').checked;
        if (!useCalendar && !useEmail) { alert('Please select at least one method (Calendar or Email).'); return; }

        const types = [];
        if (useCalendar) types.push('calendar');
        if (useEmail) types.push('email');

        btnSchedule.innerText = 'Scheduling...';
        btnSchedule.disabled = true;

        chrome.runtime.sendMessage({
            action: 'schedule_reminder',
            data: {
                types,
                title: 'Read LinkedIn Post',
                description: `Read this post: ${postData.url}\n\nSnippet: ${postData.text}`,
                startTime
            }
        }, (response) => {
            btnSchedule.disabled = false;
            btnSchedule.innerText = 'Schedule Reminder';
            if (response && response.success) {
                overlay.remove();
                showToast('Reminder set! Keep learning & growing!');
            } else {
                alert('Failed: ' + (response?.error || 'Unknown error'));
            }
        });
    });
}

function escapeHtml(unsafe) {
    return (unsafe + '').replace(/[&<>"'`]/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'
    }[m]));
}

initObserver();