document.addEventListener("DOMContentLoaded", () => {
  // Configuration
  const API_BASE_URL =
    window.location.hostname === "localhost"
      ? "http://localhost:5000/api"
      : "https://jobtracked.onrender.com/api";
  const JOBS_API_URL = `${API_BASE_URL}/jobs`;
  const TOKEN_KEY = 'authToken';
  const USER_DATA_KEY = 'userData';
  const SESSION_CHECK_INTERVAL = 300000; // 5 minutes

  // State
  let currentUser = JSON.parse(localStorage.getItem(USER_DATA_KEY));
  let allJobs = [];

  // DOM Elements
  const elements = {
    userEmail: document.getElementById('userEmail'),
    profileImage: document.getElementById('profileImage'),
    profileBtn: document.getElementById('profileBtn'), // Profile button to trigger panel
    profilePanel: document.getElementById('profilePanel'), // Profile panel that slides
    closePanel: document.getElementById('closePanel'), // Close button inside panel
    overlay: document.getElementById('overlay'), // Overlay element
    logoutBtn: document.getElementById('logoutBtn'),
    companyInput: document.querySelector('input[placeholder="Company"]'),
    positionInput: document.querySelector('input[placeholder="Position"]'),
    addButton: document.querySelector('#addJobBtn'),
    jobList: document.querySelector('.job-list'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    sortSelect: document.querySelector('select'),
    spinner: document.getElementById('spinner'),
    searchInput: document.getElementById('searchInput')
  };

  // Helper function to get headers with authentication
  function getAuthHeaders(includeContentType = false) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    
    return headers;
  }

  // Initialize Dashboard
  async function initializeDashboard() {
    console.log('Initializing dashboard...');
    
    // First check URL for token from Google auth
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const token = urlParams.get('token');
    
    if (token) {
      console.log('Found URL token, storing...');
      localStorage.setItem(TOKEN_KEY, token);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Try multiple authentication methods
    let authSuccess = false;

    // 1. Try localStorage token
    const storedToken = localStorage.getItem(TOKEN_KEY) || token;
    if (storedToken) {
      console.log('Trying localStorage token...');
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
          headers: { 'Authorization': `Bearer ${storedToken}` },
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          currentUser = data.user;
          localStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user));
          authSuccess = true;
          console.log('localStorage token authentication successful');
        } else {
          console.log('localStorage token invalid, removing...');
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_DATA_KEY);
        }
      } catch (error) {
        console.error('localStorage token verification failed:', error);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_DATA_KEY);
      }
    }

    // 2. If no token auth, try cookie auth (for Google OAuth)
    if (!authSuccess) {
      console.log('Trying cookie authentication...');
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          currentUser = data.user;
          localStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user));
          
          // Try to get token for API calls
          try {
            const tokenResponse = await fetch(`${API_BASE_URL}/auth/get-token`, {
              credentials: 'include'
            });
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              localStorage.setItem(TOKEN_KEY, tokenData.token);
            }
          } catch (tokenError) {
            console.log('Could not get token, will use cookie auth for API calls');
          }
          
          authSuccess = true;
          console.log('Cookie authentication successful');
        }
      } catch (error) {
        console.error('Cookie authentication failed:', error);
      }
    }

    if (!authSuccess) {
      console.log('No valid authentication found, redirecting to login...');
      return redirectToLogin();
    }

    // Continue with dashboard initialization
    updateUserInfo();
    await loadJobs();
    startSessionMonitoring();
    setupEventListeners();
  }

  // Update user info display
  function updateUserInfo() {
    if (elements.userEmail && currentUser) {
      elements.userEmail.textContent = currentUser.email;
    }
    if (elements.profileImage && currentUser) {
      elements.profileImage.src = currentUser.profilePicture || '../assets/images/profileicon.svg';
      elements.profileImage.onerror = () => {
        elements.profileImage.src = '../assets/images/profileicon.svg';
      };
    }
  }

  // Session management
  async function verifyToken(token) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.ok;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }

  function startSessionMonitoring() {
    setInterval(async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token || !(await verifyToken(token))) {
        redirectToLogin();
      }
    }, SESSION_CHECK_INTERVAL);
  }

  // Handle logout
  async function handleLogout() {
    console.log('Logout clicked');
    showSpinner();
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        credentials: 'include' // Include cookies
      });

      // Clear local storage regardless of server response
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      
      // Redirect to login page
      window.location.href = '/frontend/pages/JobTrackerSignUp.html';
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear storage and redirect on error
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      window.location.href = '/frontend/pages/JobTrackerSignUp.html';
    } finally {
      hideSpinner();
    }
  }

  // Redirect to login
  function redirectToLogin() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    window.location.href = '/frontend/pages/JobTrackerSignUp.html';
  }

  // Job management
  async function loadJobs(filter = 'all', sort = 'Newest', search = '') {
    showSpinner();
    try {
      const response = await fetch(`${JOBS_API_URL}?filter=${filter}&sort=${sort}&search=${encodeURIComponent(search)}`, {
        headers: getAuthHeaders(),
        credentials: 'include' // Include cookies for authentication
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          redirectToLogin();
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch jobs');
      }
      
      allJobs = await response.json();
      renderJobs(allJobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      showError(error.message || 'Failed to load jobs. Please try again.');
    } finally {
      hideSpinner();
    }
  }

  // Render jobs
  function renderJobs(jobs) {
    if (!elements.jobList) return;
    
    if (jobs.length === 0) {
      elements.jobList.innerHTML = '<div class="text-center text-gray-500 py-8">No jobs found</div>';
      return;
    }
    
    elements.jobList.innerHTML = jobs.map(job => `
      <div class="job-item cursor-pointer" data-id="${job._id}" data-status="${job.status || 'pending'}">
        <div class="flex flex-col md:flex-row justify-start items-start w-full bg-white border border-[#828282] rounded-lg p-4 hover:shadow-md transition-shadow">
          <div class="flex flex-col justify-center items-center w-full">
            <div class="flex flex-col md:flex-row justify-between items-start w-full gap-4">
              <h4 class="text-xl md:text-2xl font-bold leading-tight text-left text-[#1e1e1e]">${job.company || 'Unknown Company'}</h4>
              <div class="flex flex-row justify-center items-center self-end w-auto md:w-[28%] border-0 border-[#00000033] rounded-sm"
                style="background-color: ${getStatusColor(job.status)}; 
                       color: ${(job.status === 'pending') ? '#1e1e1e' : '#ffffff'}">
                <span class="px-8 py-1 text-base">${capitalize(job.status)}</span>
              </div>
            </div>
            <div class="flex flex-col md:flex-row justify-center items-center w-full mt-2 gap-4">
              <div class="flex flex-col gap-1 justify-start items-start flex-1">
                <div class="flex flex-row justify-start items-center w-full">
                  <img src="../assets/images/img_code.svg" class="w-5 h-[18px]" alt="code icon" />
                  <span class="text-xs md:text-sm text-[#000000] self-end ml-2">${job.position || 'Unknown Position'}</span>
                </div>
                <span class="text-xs text-[#000000]">Added ${formatDate(job.createdAt)}</span>
              </div>
              <div class="flex flex-row justify-end items-center self-end gap-2">
                <img src="../assets/images/img_edit_btn.svg" class="w-[18px] h-4 cursor-pointer hover:opacity-70 transition-opacity edit-btn" alt="edit" data-job-id="${job._id}" />
                <img src="../assets/images/img_delete_btn.svg" class="w-5 h-5 cursor-pointer hover:opacity-70 transition-opacity delete-btn" alt="delete" data-job-id="${job._id}" />
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  async function addJob() {
    const company = elements.companyInput?.value.trim();
    const position = elements.positionInput?.value.trim();
    
    if (!company || !position) {
      showError('Please fill in both company and position fields');
      return;
    }

    showSpinner();
    try {
      const response = await fetch(`${JOBS_API_URL}`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ company, position })
      });

      if (!response.ok) {
        if (response.status === 401) {
          redirectToLogin();
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add job');
      }

      const result = await response.json();
      const newJob = result.job || result; // Handle both response formats
      
      // Ensure the new job has default values for required fields
      const jobWithDefaults = {
        ...newJob,
        company: newJob.company || company,
        position: newJob.position || position,
        status: newJob.status || 'pending',
        createdAt: newJob.createdAt || new Date().toISOString()
      };
      
      // Update the jobs array and re-render immediately
      allJobs.unshift(jobWithDefaults);
      renderJobs(allJobs);
      
      // Clear inputs
      elements.companyInput.value = '';
      elements.positionInput.value = '';
      
      showSuccess('Job added successfully!');
    } catch (error) {
      console.error('Add job error:', error);
      showError(error.message || 'Failed to add job. Please try again.');
    } finally {
      hideSpinner();
    }
  }

  async function deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job?')) return;
    
    showSpinner();
    try {
      const response = await fetch(`${JOBS_API_URL}/${jobId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include' // Include cookies for authentication
      });

      if (!response.ok) {
        if (response.status === 401) {
          redirectToLogin();
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

      allJobs = allJobs.filter(j => j._id !== jobId);
      renderJobs(allJobs);
      showSuccess('Job deleted successfully!');
    } catch (error) {
      showError(error.message || 'Failed to delete job. Please try again.');
      console.error('Error deleting job:', error);
    } finally {
      hideSpinner();
    }
  }

  async function updateJob(jobId, updatedData) {
    showSpinner();
    try {
      const response = await fetch(`${JOBS_API_URL}/${jobId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(updatedData)
      });

      if (!response.ok) {
        if (response.status === 401) {
          redirectToLogin();
          return false;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Update failed');
      }
      
      const updatedJob = await response.json();
      const index = allJobs.findIndex(j => j._id === jobId);
      if (index !== -1) allJobs[index] = updatedJob;
      renderJobs(allJobs);
      showSuccess('Job updated successfully!');
      return true;
    } catch (error) {
      showError(error.message || 'Failed to update job. Please try again.');
      console.error('Error updating job:', error);
      return false;
    } finally {
      hideSpinner();
    }
  }

  function showJobDetail(job) {
    const detailEl = document.createElement('div');
    detailEl.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
    detailEl.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full relative">
        <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-700 close-detail">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h3 class="text-2xl font-bold mb-2">${job.company}</h3>
        <p class="text-lg mb-1">${job.position}</p>
        <p class="text-gray-600 mb-4">
          Status: <span class="font-medium" style="color: ${getStatusColor(job.status)}">${capitalize(job.status)}</span>
        </p>
        <p class="text-sm text-gray-500 mb-2">Added: ${new Date(job.createdAt).toLocaleDateString()}</p>
        ${job.updatedAt ? `<p class="text-sm text-gray-500">Last updated: ${new Date(job.updatedAt).toLocaleDateString()}</p>` : ''}
      </div>
    `;
    
    detailEl.querySelector('.close-detail').addEventListener('click', () => {
      detailEl.remove();
    });
    
    // Close on overlay click
    detailEl.addEventListener('click', (e) => {
      if (e.target === detailEl) {
        detailEl.remove();
      }
    });
    
    document.body.appendChild(detailEl);
  }

  function showEditForm(job) {
    const editEl = document.createElement('div');
    editEl.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
    editEl.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full relative">
        <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-700 close-edit">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h3 class="text-xl font-bold mb-4">Edit Job</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input type="text" value="${job.company}" class="edit-company w-full p-2 border rounded">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Position</label>
            <input type="text" value="${job.position}" class="edit-position w-full p-2 border rounded">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select class="edit-status w-full p-2 border rounded">
              <option value="pending" ${job.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="interview" ${job.status === 'interview' ? 'selected' : ''}>Interview</option>
              <option value="declined" ${job.status === 'declined' ? 'selected' : ''}>Declined</option>
              <option value="accepted" ${job.status === 'accepted' ? 'selected' : ''}>Accepted</option>
            </select>
          </div>
          <button class="save-edit w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    `;
    
    editEl.querySelector('.close-edit').addEventListener('click', () => {
      editEl.remove();
    });
    
    // Close on overlay click
    editEl.addEventListener('click', (e) => {
      if (e.target === editEl) {
        editEl.remove();
      }
    });
    
    editEl.querySelector('.save-edit').addEventListener('click', async () => {
      const updatedData = {
        company: editEl.querySelector('.edit-company').value.trim(),
        position: editEl.querySelector('.edit-position').value.trim(),
        status: editEl.querySelector('.edit-status').value
      };
      
      if (!updatedData.company || !updatedData.position) {
        showError('Please fill in all fields');
        return;
      }
      
      const success = await updateJob(job._id, updatedData);
      if (success) {
        editEl.remove();
      }
    });
    
    document.body.appendChild(editEl);
  }

  // UI Helpers
  function showSpinner() {
    if (elements.spinner) {
      elements.spinner.classList.remove('hidden');
    }
  }

  function hideSpinner() {
    if (elements.spinner) {
      elements.spinner.classList.add('hidden');
    }
  }

  function showError(message, duration = 5000) {
    const errorEl = document.createElement('div');
    errorEl.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded shadow-lg z-50 flex items-center';
    errorEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>${message}</span>
    `;
    
    document.body.appendChild(errorEl);
    
    setTimeout(() => {
      errorEl.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => errorEl.remove(), 300);
    }, duration);
  }

  function showSuccess(message, duration = 3000) {
    const successEl = document.createElement('div');
    successEl.className = 'fixed top-4 right-4 bg-green-500 text-white p-4 rounded shadow-lg z-50 flex items-center';
    successEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>${message}</span>
    `;
    
    document.body.appendChild(successEl);
    
    setTimeout(() => {
      successEl.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => successEl.remove(), 300);
    }, duration);
  }

  function capitalize(str) {
    if (!str || typeof str !== 'string') return 'Unknown';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diff === 0 ? 'today' : `${diff} day${diff > 1 ? 's' : ''} ago`;
  }

  function getStatusColor(status) {
    const colors = {
      accepted: '#34a853',
      pending: '#fbbc05',
      interview: '#4285f4',
      declined: '#eb4335'
    };
    return colors[status] || '#cccccc';
  }

  // Profile panel functionality - FIXED VERSION
  function openProfilePanel() {
    console.log('Opening profile panel...');
    
    if (!elements.profilePanel || !elements.overlay) {
      console.error('Profile panel or overlay not found!');
      return;
    }
    
    // Show overlay
    elements.overlay.classList.remove('hidden');
    
    // Show and slide in panel
    elements.profilePanel.classList.remove('-translate-x-full');
    elements.profilePanel.classList.add('translate-x-0');
  }

  function closeProfilePanel() {
    console.log('Closing profile panel...');
    
    if (!elements.profilePanel || !elements.overlay) {
      console.error('Profile panel or overlay not found!');
      return;
    }
    
    // Hide panel - slide out
    elements.profilePanel.classList.remove('translate-x-0');
    elements.profilePanel.classList.add('-translate-x-full');
    
    // Hide overlay
    elements.overlay.classList.add('hidden');
  }

  // Setup event listeners
  function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Profile button to open panel
    if (elements.profileBtn) {
      console.log('Profile button found, attaching event listener');
      elements.profileBtn.addEventListener('click', (e) => {
        console.log('Profile button clicked!');
        e.preventDefault();
        e.stopPropagation();
        openProfilePanel();
      });
    } else {
      console.error('Profile button not found! Check if element ID "profileBtn" exists');
    }

    // Close button inside panel
    if (elements.closePanel) {
      console.log('Close panel button found, attaching event listener');
      elements.closePanel.addEventListener('click', (e) => {
        console.log('Close panel button clicked!');
        e.preventDefault();
        e.stopPropagation();
        closeProfilePanel();
      });
    } else {
      console.error('Close panel button not found! Check if element ID "closePanel" exists');
    }

    // Overlay click to close panel
    if (elements.overlay) {
      elements.overlay.addEventListener('click', (e) => {
        console.log('Overlay clicked, closing panel');
        e.preventDefault();
        closeProfilePanel();
      });
    }

    // Prevent panel clicks from bubbling to overlay
    if (elements.profilePanel) {
      elements.profilePanel.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
    
    // Logout button
    if (elements.logoutBtn) {
      console.log('Logout button found, attaching event listener');
      elements.logoutBtn.addEventListener('click', (e) => {
        console.log('Logout button clicked!', e);
        e.preventDefault();
        handleLogout();
      });
    } else {
      console.error('Logout button not found! Check if element ID "logoutBtn" exists');
    }

    // Add job button
    if (elements.addButton) {
      console.log('Add button found, attaching event listener');
      elements.addButton.addEventListener('click', (e) => {
        console.log('Add job button clicked!', e);
        e.preventDefault();
        addJob();
      });
    } else {
      console.error('Add button not found! Check if element ID "addJobBtn" exists');
    }

    // Handle Enter key in input fields
    elements.positionInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addJob();
      }
    });

    elements.companyInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addJob();
      }
    });

    // Filter buttons
    elements.filterButtons?.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.filterButtons.forEach(b => b.classList.remove('bg-[#4285f4]', 'text-white', 'active-filter'));
        btn.classList.add('bg-[#4285f4]', 'text-white', 'active-filter');
        const filter = btn.dataset.filter;
        const sort = elements.sortSelect?.value || 'Newest';
        const search = elements.searchInput?.value || '';
        loadJobs(filter, sort, search);
      });
    });

    // Sort select
    elements.sortSelect?.addEventListener('change', () => {
      const filter = document.querySelector('.filter-btn.active-filter')?.dataset.filter || 'all';
      const sort = elements.sortSelect.value;
      const search = elements.searchInput?.value || '';
      loadJobs(filter, sort, search);
    });

    // Search input
    elements.searchInput?.addEventListener('input', debounce(() => {
      const filter = document.querySelector('.filter-btn.active-filter')?.dataset.filter || 'all';
      const sort = elements.sortSelect?.value || 'Newest';
      const search = elements.searchInput.value;
      loadJobs(filter, sort, search);
    }, 300));

    // FIXED: Job list interactions with proper event delegation
    elements.jobList?.addEventListener('click', (e) => {
      console.log('Job list clicked:', e.target);
      
      // Check if clicked element is a delete button
      if (e.target.classList.contains('delete-btn')) {
        e.stopPropagation();
        e.preventDefault();
        const jobId = e.target.getAttribute('data-job-id');
        console.log('Delete button clicked for job:', jobId);
        if (jobId) {
          deleteJob(jobId);
        }
        return;
      }
      
      // Check if clicked element is an edit button
      if (e.target.classList.contains('edit-btn')) {
        e.stopPropagation();
        e.preventDefault();
        const jobId = e.target.getAttribute('data-job-id');
        console.log('Edit button clicked for job:', jobId);
        if (jobId) {
          const job = allJobs.find(j => j._id === jobId);
          if (job) {
            showEditForm(job);
          }
        }
        return;
      }
      
      // Check if clicked on job item (for details)
      const jobItem = e.target.closest('.job-item');
      if (jobItem) {
        const jobId = jobItem.getAttribute('data-id');
        console.log('Job item clicked for details:', jobId);
        if (jobId) {
          const job = allJobs.find(j => j._id === jobId);
          if (job) {
            showJobDetail(job);
          }
        }
      }
    });
  }

  // Utility functions
  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait);
    };
  }

  // Start the dashboard
  initializeDashboard();
});