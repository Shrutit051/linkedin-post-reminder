document.getElementById('sign-out').addEventListener('click', () => {
    const btn = document.getElementById('sign-out');
    const msg = document.getElementById('msg');

    btn.disabled = true;
    btn.innerText = 'Signing Out...';

    chrome.runtime.sendMessage({ action: 'sign_out' }, (response) => {
        if (response && response.success) {
            msg.innerText = 'Signed out successfully.';
            btn.innerText = 'Sign Out';
            btn.disabled = false;
        } else {
            msg.innerText = 'Error signing out.';
            btn.disabled = false;
        }
    });
});
