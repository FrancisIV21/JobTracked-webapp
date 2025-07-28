""// ==== GLOBAL HELPERS ====
const showSpinner = () => document.getElementById('spinner').classList.remove('hidden');
const hideSpinner = () => document.getElementById('spinner').classList.add('hidden');
const API_URL = 'http://localhost:5000/api/jobs';

// ==== DOM READY ====
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email");
  const name = params.get("name");
  const profilePicture = params.get("profilePicture");
  const provider = params.get("provider");
  const token = params.get("token");

  if (email && name && token) {
    const user = { email, name, profilePicture, provider, token };
    localStorage.setItem("user", JSON.stringify(user));
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const user = JSON.parse(localStorage.getItem("user"));
  const userEmail = user?.email;
  const userToken = user?.token;

  if (!user || !userToken) {
    window.location.href = 'JobTrackerSignUp.html';
    return;
  }

  document.getElementById('userEmail').textContent = `Email: ${user.email}`;
  document.getElementById('profileImage').src = user.profilePicture || '../assets/images/default-profile.png';

  const togglePanel = (open) => {
    document.getElementById('profilePanel').classList.toggle('-translate-x-full', !open);
    document.getElementById('overlay').classList.toggle('hidden', !open);
  };

  document.getElementById('profileBtn').addEventListener('click', () => togglePanel(true));
  document.getElementById('closePanel').addEventListener('click', () => togglePanel(false));
  document.getElementById('overlay').addEventListener('click', () => togglePanel(false));

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem("user");
    window.location.href = "JobTrackerSignUp.html";
  });

  document.querySelector('#filter-all').classList.add('bg-[#4285f4]', 'text-white', 'active-filter');

  const companyInput = document.querySelector('input[placeholder="Company"]');
  const positionInput = document.querySelector('input[placeholder="Position"]');
  const addButton = document.querySelector('#addJobBtn');
  const jobList = document.querySelector('.job-list');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const sortSelect = document.querySelector('select');

  let allJobs = [];

  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diff === 0 ? 'today' : `${diff} day${diff > 1 ? 's' : ''} ago`;
  };

  const renderJob = (job) => {
    return `
      <div class="job-item" data-id="${job._id}" data-status="${job.status}">
        <div class="flex flex-col md:flex-row justify-start items-start w-full bg-white border border-[#828282] rounded-lg p-4">
          <div class="flex flex-col justify-center items-center w-full">
            <div class="flex flex-col md:flex-row justify-between items-start w-full gap-4">
              <h4 class="text-xl md:text-2xl font-bold leading-tight text-left text-[#1e1e1e]">${job.company}</h4>
              <div class="flex flex-row justify-center items-center self-end w-auto md:w-[28%] border-0 border-[#00000033] rounded-sm"
                style="background-color: ${
                  job.status === 'accepted' ? '#34a853' :
                  job.status === 'pending' ? '#fbbc05' :
                  job.status === 'interview' ? '#4285f4' :
                  job.status === 'declined' ? '#eb4335' : ''
                }; color: ${
                  job.status === 'pending' ? '#1e1e1e' : '#ffffff'
                }">
                <span class="px-8 py-1 text-base">${capitalize(job.status)}</span>
              </div>
            </div>
            <div class="flex flex-col md:flex-row justify-center items-center w-full mt-2 gap-4">
              <div class="flex flex-col gap-1 justify-start items-start flex-1">
                <div class="flex flex-row justify-start items-center w-full">
                  <img src="../assets/images/img_code.svg" class="w-5 h-[18px]" alt="code icon" />
                  <span class="text-xs md:text-sm text-[#000000] self-end ml-2">${job.position}</span>
                </div>
                <span class="text-xs text-[#000000]">Added ${formatDate(job.createdAt)}</span>
              </div>
              <div class="flex flex-row justify-end items-center self-end gap-2">
                <img src="../assets/images/img_edit_btn.svg" class="w-[18px] h-4 cursor-pointer hover:opacity-70 transition-opacity edit-btn" alt="edit" />
                <img src="../assets/images/img_delete_btn.svg" class="w-5 h-5 cursor-pointer hover:opacity-70 transition-opacity delete-btn" alt="delete" />
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const renderJobs = (jobs) => {
    jobList.innerHTML = jobs.map(renderJob).join('');
  };

  const loadJobs = async (filter = 'all', sort = 'Newest') => {
    try {
      const res = await fetch(`${API_URL}`, {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      });
      let jobs = await res.json();
      allJobs = jobs;

      if (filter !== 'all') {
        jobs = jobs.filter(job => job.status === filter);
      }

      if (sort === 'Newest') {
        jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else if (sort === 'Oldest') {
        jobs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      } else if (sort === 'Company A-Z') {
        jobs.sort((a, b) => a.company.localeCompare(b.company));
      }

      renderJobs(jobs);
    } catch (err) {
      console.error('Failed to load jobs', err);
    }
  };

  addButton.addEventListener('click', async () => {
    const company = companyInput.value.trim();
    const position = positionInput.value.trim();
    if (!company || !position) return alert('Please fill in both fields');

    const tempJob = {
      _id: `temp-${Date.now()}`,
      company,
      position,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    allJobs.unshift(tempJob);
    renderJobs(allJobs);

    try {
      showSpinner();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({ company, position })
      });

      const savedJob = await res.json();
      if (!res.ok) throw new Error(savedJob?.error || 'Failed to add job');

      allJobs = allJobs.map(j => j._id === tempJob._id ? savedJob : j);
      renderJobs(allJobs);
    } catch (err) {
      alert('Error adding job');
      allJobs = allJobs.filter(j => j._id !== tempJob._id);
      renderJobs(allJobs);
      console.error(err);
    } finally {
      hideSpinner();
    }

    companyInput.value = '';
    positionInput.value = '';
  });

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      filterButtons.forEach(b => {
        b.classList.remove('bg-[#4285f4]', 'text-white', 'active-filter');
        b.classList.add('bg-white', 'text-[#1e1e1e]');
      });

      btn.classList.remove('bg-white', 'text-[#1e1e1e]');
      btn.classList.add('bg-[#4285f4]', 'text-white', 'active-filter');

      loadJobs(filter, sortSelect.value);
    });
  });

  sortSelect.addEventListener('change', () => {
    loadJobs(getCurrentFilter(), sortSelect.value);
  });

  jobList.addEventListener('click', async (e) => {
    const jobDiv = e.target.closest('.job-item');
    const jobId = jobDiv?.dataset?.id;

    if (e.target.classList.contains('delete-btn')) {
      if (!confirm('Are you sure you want to delete this job?')) return;

      const originalJobs = [...allJobs];
      allJobs = allJobs.filter(j => j._id !== jobId);
      renderJobs(allJobs);

      try {
        showSpinner();
        const res = await fetch(`${API_URL}/${jobId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${userToken}`
          }
        });
        if (!res.ok) throw new Error('Delete failed');
      } catch (err) {
        alert('Error deleting job');
        allJobs = originalJobs;
        renderJobs(allJobs);
        console.error(err);
      } finally {
        hideSpinner();
      }
    }

    if (e.target.classList.contains('edit-btn')) {
      const job = allJobs.find(j => j._id === jobId);
      if (!job) return;

      jobDiv.innerHTML = `
        <div class="flex flex-col justify-start gap-3">
          <input type="text" class="edit-company px-4 py-2 border rounded-md" value="${job.company}" />
          <input type="text" class="edit-position px-4 py-2 border rounded-md" value="${job.position}" />
          <select class="edit-status px-4 py-2 border rounded-md">
            <option value="pending" ${job.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="interview" ${job.status === 'interview' ? 'selected' : ''}>Interview</option>
            <option value="declined" ${job.status === 'declined' ? 'selected' : ''}>Declined</option>
            <option value="accepted" ${job.status === 'accepted' ? 'selected' : ''}>Accepted</option>
          </select>
          <div class="flex gap-2">
            <button class="save-edit px-4 py-2 bg-green-500 text-white rounded-md">Save</button>
            <button class="cancel-edit px-4 py-2 bg-gray-400 text-white rounded-md">Cancel</button>
          </div>
        </div>
      `;
    }

    if (e.target.classList.contains('cancel-edit')) {
      const job = allJobs.find(j => j._id === jobId);
      if (!job) return;
      jobDiv.outerHTML = renderJob(job);
    }

    if (e.target.classList.contains('save-edit')) {
      const updatedCompany = jobDiv.querySelector('.edit-company').value.trim();
      const updatedPosition = jobDiv.querySelector('.edit-position').value.trim();
      const updatedStatus = jobDiv.querySelector('.edit-status').value;

      showSpinner();

      try {
        const res = await fetch(`${API_URL}/${jobId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`
          },
          body: JSON.stringify({ company: updatedCompany, position: updatedPosition, status: updatedStatus })
        });

        if (!res.ok) throw new Error('Update failed');

        const updatedJob = await res.json();
        const index = allJobs.findIndex(j => j._id === jobId);
        if (index !== -1) allJobs[index] = updatedJob;

        renderJobs(allJobs);
      } catch (err) {
        alert('Failed to update job');
        console.error(err);
      } finally {
        hideSpinner();
      }
    }
  });

  const getCurrentFilter = () => {
    const activeBtn = document.querySelector('.filter-btn.active-filter');
    return activeBtn ? activeBtn.dataset.filter : 'all';
  };

  loadJobs();
});
