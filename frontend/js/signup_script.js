document.addEventListener("DOMContentLoaded", () => {
    const emailInput = document.querySelector('input[type="email"]');
    const continueBtn = document.getElementById('signupBtn');

    // Check if user is already logged in
    checkExistingSession();

    // Message box
    const messageBox = document.createElement('div');
    messageBox.className = "mt-4 text-center text-sm font-medium";
    emailInput.parentElement.appendChild(messageBox);

    async function checkExistingSession() {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user.token && user.email) {
            // Verify session with backend
            const response = await fetch('http://localhost:5000/api/auth/verify-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: user.token, email: user.email })
            });

            if (response.ok) {
              // Session is valid, redirect to dashboard
              console.log('[SESSION VALID] Redirecting to dashboard');
              window.location.href = '/pages/JobTrackerDashboard.html';
              return;
            } else {
              // Session invalid, clear localStorage
              console.log('[SESSION INVALID] Clearing local storage');
              localStorage.removeItem('user');
            }
          }
        } catch (error) {
          console.error('[SESSION CHECK ERROR]', error);
          localStorage.removeItem('user');
        }
      }
    }

continueBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();

  if (!email) return showMessage('Please enter a valid email.', 'error');

  const endpoint = 'http://localhost:5000/api/auth/login';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    // First check if response is OK
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // Session conflict - clear local storage
        localStorage.removeItem('user');
        showMessage(errorData.message || 'You are already logged in elsewhere. Session cleared, please try again.', 'error');
      } else {
        showMessage(errorData.message || 'Login failed. Please try again.', 'error');
      }
      return;
    }

    // If response is OK, parse the data
    const data = await res.json();
    console.log('Login successful, received data:', data); // Debug log

    if (data.token) {
      // Store user data
      const user = {
        ...data.user,
        token: data.token,
        profilePicture: data.user.profilePicture || null
      };
      localStorage.setItem('user', JSON.stringify(user));
      
      // Show success message and redirect
      showMessage('Success! Redirecting...', 'success');
      console.log('Redirecting to dashboard...'); // Debug log
      window.location.href = '/pages/JobTrackerDashboard.html';
    } else {
      console.error('Token missing in response:', data);
      showMessage('Login successful but missing token. Please try again.', 'error');
    }

  } catch (error) {
    console.error('[ERROR] Login request failed:', error);
    showMessage('Something went wrong. Please try again.', 'error');
  }
});

    function showMessage(msg, type) {
      messageBox.textContent = msg || '';
      messageBox.className = `mt-4 text-center text-sm font-medium ${
        type === 'error' ? 'text-red-600' : type === 'success' ? 'text-green-600' : ''
      }`;
    }
  });