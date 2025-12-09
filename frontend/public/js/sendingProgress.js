// Sending Progress UI
// Real-time progress tracking for email campaigns

let progressData = {
  campaignId: null,
  pollInterval: null,
  isPolling: false
};

/**
 * Show sending progress modal and start polling
 * @param {number} campaignId - Campaign ID to track
 */
function showSendingProgress(campaignId) {
  progressData.campaignId = campaignId;
  createProgressModal();
  startProgressPolling();
}

/**
 * Create progress modal
 */
function createProgressModal() {
  // Remove existing modal if any
  const existing = document.getElementById('sendingProgressModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'sendingProgressModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container progress-modal">
      <div class="modal-header">
        <h3 class="modal-title">Sending Campaign</h3>
      </div>

      <div class="modal-body">
        <div class="progress-container">
          <div class="progress-bar-wrapper">
            <div class="progress-bar" id="progressBar" style="width: 0%"></div>
          </div>
          <div class="progress-percentage" id="progressPercentage">0%</div>
        </div>

        <div class="progress-stats">
          <div class="stat-item">
            <div class="stat-label">Status</div>
            <div class="stat-value" id="campaignStatus">Preparing...</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Total Recipients</div>
            <div class="stat-value" id="totalRecipients">-</div>
          </div>
          <div class="stat-item success">
            <div class="stat-label">Sent</div>
            <div class="stat-value" id="sentCount">0</div>
          </div>
          <div class="stat-item error">
            <div class="stat-label">Failed</div>
            <div class="stat-value" id="failedCount">0</div>
          </div>
        </div>

        <div class="progress-message" id="progressMessage">
          Initializing email sending...
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="cancelSending()" id="cancelBtn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Prevent closing by clicking overlay during send
  modal.addEventListener('click', (e) => {
    if (e.target === modal && !progressData.isPolling) {
      closeSendingProgress();
    }
  });
}

/**
 * Start polling for progress updates
 */
function startProgressPolling() {
  progressData.isPolling = true;

  // Initial poll
  updateProgress();

  // Poll every 2 seconds
  progressData.pollInterval = setInterval(() => {
    updateProgress();
  }, 2000);
}

/**
 * Update progress from API
 */
async function updateProgress() {
  if (!progressData.campaignId) return;

  try {
    const response = await API.getCampaignProgress(progressData.campaignId);
    console.log('Progress response:', response);

    // Map backend response to expected format
    const progress = {
      status: response.campaign.status,
      total_recipients: response.progress.total_recipients,
      sent_count: response.progress.sent,
      failed_count: response.progress.failed,
      percentage: response.progress.percentage
    };

    console.log('Mapped progress:', progress);

    // Update UI
    updateProgressUI(progress);

    // Check if complete
    if (progress.status === 'completed' || progress.status === 'failed') {
      stopProgressPolling();
      showCompletionSummary(progress);
    }
  } catch (error) {
    console.error('Failed to fetch progress:', error);
    // Continue polling despite errors
  }
}

/**
 * Update progress UI elements
 */
function updateProgressUI(progress) {
  const total = progress.total_recipients || 0;
  const sent = progress.sent_count || 0;
  const failed = progress.failed_count || 0;
  const percentage = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;

  // Update progress bar
  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    progressBar.style.width = percentage + '%';

    // Change color based on status
    if (progress.status === 'completed') {
      progressBar.style.background = 'var(--success-color)';
    } else if (progress.status === 'failed') {
      progressBar.style.background = 'var(--error-color)';
    }
  }

  // Update percentage
  const percentageEl = document.getElementById('progressPercentage');
  if (percentageEl) {
    percentageEl.textContent = percentage + '%';
  }

  // Update stats
  document.getElementById('campaignStatus').textContent = capitalizeFirst(progress.status);
  document.getElementById('totalRecipients').textContent = total;
  document.getElementById('sentCount').textContent = sent;
  document.getElementById('failedCount').textContent = failed;

  // Update message
  const messageEl = document.getElementById('progressMessage');
  if (messageEl) {
    if (progress.status === 'sending') {
      messageEl.textContent = `Sending email ${sent + failed} of ${total}...`;
    } else if (progress.status === 'completed') {
      messageEl.textContent = 'Campaign completed successfully!';
      messageEl.className = 'progress-message success';
    } else if (progress.status === 'failed') {
      messageEl.textContent = 'Campaign sending failed';
      messageEl.className = 'progress-message error';
    }
  }
}

/**
 * Stop progress polling
 */
function stopProgressPolling() {
  progressData.isPolling = false;
  if (progressData.pollInterval) {
    clearInterval(progressData.pollInterval);
    progressData.pollInterval = null;
  }
}

/**
 * Show completion summary
 */
function showCompletionSummary(progress) {
  const modal = document.getElementById('sendingProgressModal');
  if (!modal) return;

  const total = progress.total_recipients || 0;
  const sent = progress.sent_count || 0;
  const failed = progress.failed_count || 0;
  const successRate = total > 0 ? Math.round((sent / total) * 100) : 0;

  // Update modal footer with completion actions
  const footer = modal.querySelector('.modal-footer');
  if (footer) {
    footer.innerHTML = `
      <button type="button" class="btn btn-primary" onclick="closeSendingProgress()">Close</button>
    `;
  }

  // Disable cancel button
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) {
    cancelBtn.style.display = 'none';
  }
}

/**
 * Cancel sending
 */
function cancelSending() {
  if (!confirm('Are you sure you want to cancel sending?')) {
    return;
  }

  stopProgressPolling();
  closeSendingProgress();
  alert('Sending cancelled');
}

/**
 * Close progress modal
 */
function closeSendingProgress() {
  stopProgressPolling();
  const modal = document.getElementById('sendingProgressModal');
  if (modal) {
    modal.remove();
  }

  // Refresh dashboard and campaign list
  if (typeof loadDashboard === 'function') {
    loadDashboard();
  }
  if (typeof loadCampaignHistory === 'function') {
    loadCampaignHistory();
  }
}

/**
 * Helper to capitalize first letter
 */
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
