document.addEventListener("DOMContentLoaded", () => {
  const config = {
  frontendBaseUrl: window.location.origin,
  backendUrl: window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://jobtracked.onrender.com',
  dashboardPath: '/frontend/pages/JobTrackerDashboard.html',
  signupPath: '/frontend/pages/JobTrackerSignUp.html',
  tokenKey: 'authToken',
  userDataKey: 'userData'
};

  function createMessageBox(continueBtn) {
    const box = document.createElement('div');
    box.id = 'messageBox';
    box.className = 'mt-4 text-center text-sm font-medium';
    continueBtn.parentNode.insertBefore(box, continueBtn.nextSibling);
    return box;
  }

  const elements = {
    emailInput: document.querySelector('input[type="email"]'),
    continueBtn: document.getElementById('signupBtn'),
    googleLoginBtn: document.getElementById('googleLoginBtn')
  };

  // Create the messageBox
  elements.messageBox = document.getElementById('messageBox') || createMessageBox(elements.continueBtn);

  function showMessage(msg, type = 'info') {
    elements.messageBox.textContent = msg;
    elements.messageBox.className = `mt-4 text-center text-sm font-medium ${
      type === 'error' ? 'text-red-600' :
      type === 'success' ? 'text-green-600' : 'text-blue-600'
    }`;
  }

  async function handleEmailLogin(email) {
    try {
      showMessage('Logging in...', 'info');
      const response = await fetch(`${config.backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user data
      if (data.token) {
        localStorage.setItem(config.tokenKey, data.token);
      }
      if (data.user) {
        localStorage.setItem(config.userDataKey, JSON.stringify(data.user));
      }
      
      showMessage('Login successful! Redirecting...', 'success');

      setTimeout(() => {
        window.location.href = data.redirect || config.dashboardPath;
      }, 1000);
    } catch (error) {
      console.error('Login error:', error);
      showMessage(error.message || 'Authentication failed. Please try again.', 'error');
    }
  }

  async function checkExistingSession() {
    console.log('Checking existing session...');

    try {
      // 1. Check for URL hash token (from OAuth redirects)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlToken = hashParams.get('token');

      if (urlToken) {
        console.log('Found URL token, processing...');
        localStorage.setItem(config.tokenKey, urlToken);
        
        // Clear the hash from URL
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
        
        // Verify the token and get user data
        try {
          const response = await fetch(`${config.backendUrl}/api/auth/verify`, {
            headers: { 'Authorization': `Bearer ${urlToken}` },
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            localStorage.setItem(config.userDataKey, JSON.stringify(data.user));
            console.log('Token verification successful, redirecting...');
            showMessage('Login successful! Redirecting...', 'success');
            setTimeout(() => {
              window.location.href = config.dashboardPath;
            }, 1000);
            return true;
          } else {
            console.error('Token verification failed');
            localStorage.removeItem(config.tokenKey);
          }
        } catch (error) {
          console.error('Token verification error:', error);
          localStorage.removeItem(config.tokenKey);
        }
      }

      // 2. Check localStorage token
      const storedToken = localStorage.getItem(config.tokenKey);
      if (storedToken) {
        console.log('Found stored token, verifying...');
        try {
          const response = await fetch(`${config.backendUrl}/api/auth/verify`, {
            headers: { 'Authorization': `Bearer ${storedToken}` },
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            localStorage.setItem(config.userDataKey, JSON.stringify(data.user));
            console.log('Stored token valid, redirecting...');
            showMessage('Session found! Redirecting...', 'success');
            setTimeout(() => {
              window.location.href = config.dashboardPath;
            }, 1000);
            return true;
          } else {
            console.log('Stored token invalid, removing...');
            localStorage.removeItem(config.tokenKey);
            localStorage.removeItem(config.userDataKey);
          }
        } catch (error) {
          console.error('Stored token verification failed:', error);
          localStorage.removeItem(config.tokenKey);
          localStorage.removeItem(config.userDataKey);
        }
      }

      // 3. Check HTTP-only cookie session
      console.log('Checking cookie session...');
      try {
        const response = await fetch(`${config.backendUrl}/api/auth/verify`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Cookie session valid, getting token...');
          
          try {
            // Get token for localStorage
            const tokenResponse = await fetch(`${config.backendUrl}/api/auth/get-token`, {
              credentials: 'include'
            });
            
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              localStorage.setItem(config.tokenKey, tokenData.token);
            }
          } catch (tokenError) {
            console.warn('Could not retrieve token for localStorage:', tokenError);
          }
          
          localStorage.setItem(config.userDataKey, JSON.stringify(data.user));
          console.log('Cookie session verified, redirecting...');
          showMessage('Session found! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = config.dashboardPath;
          }, 1000);
          return true;
        }
      } catch (error) {
        console.log('Cookie session check failed:', error);
      }

      console.log('No valid session found');
      return false;
      
    } catch (error) {
      console.error('Session check error:', error);
      return false;
    }
  }

  function handleUrlErrors() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const details = urlParams.get('details');

    if (error) {
      const errors = {
        'invalid_token': 'Session expired. Please login again.',
        'auth_failed': 'Google authentication failed. Please try again.',
        'server_error': 'Server error occurred during authentication. Please try again.',
        'session_conflict': 'Session conflict detected. Please try logging in again.',
        'no_user': 'No user data received from Google. Please try again.',
        'config_error': 'Server configuration error. Please contact support.',
        'db_error': 'Database connection error. Please try again later.',
        'save_error': 'Failed to save user data. Please try again.',
        'session_error': 'Failed to establish user session. Please try again.'
      };
      
      let errorMessage = errors[error] || 'Authentication failed. Please try again.';
      
      // Add details if available (for debugging)
      if (details && (error === 'server_error' || error === 'config_error' || error === 'db_error')) {
        errorMessage += ` (Details: ${decodeURIComponent(details)})`;
        console.error('Authentication error details:', decodeURIComponent(details));
      }
      
      showMessage(errorMessage, 'error');
      
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  // Event listeners
  elements.continueBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const email = elements.emailInput?.value.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      handleEmailLogin(email);
    } else {
      showMessage('Please enter a valid email address', 'error');
    }
  });

  elements.googleLoginBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Google login initiated...');
    showMessage('Redirecting to Google...', 'info');
    
    // Clear any existing authentication data
    localStorage.removeItem(config.tokenKey);
    localStorage.removeItem(config.userDataKey);
    
    // Add a small delay to show the message
    setTimeout(() => {
      window.location.href = `${config.backendUrl}/api/auth/google`;
    }, 500);
  });

  // Handle Enter key in email input
  elements.emailInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      elements.continueBtn?.click();
    }
  });

  // Initialize
  console.log('Initializing authentication...');
  handleUrlErrors();
  
  // Small delay to ensure DOM is fully ready
  setTimeout(() => {
    checkExistingSession();
  }, 100);
});