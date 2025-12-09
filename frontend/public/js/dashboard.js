// Dashboard Logic
// Handles dashboard display, navigation, and data loading

// Check authentication on page load
if (!TokenManager.isAuthenticated()) {
  window.location.href = '/index.html';
}

// DOM Elements
const userEmailEl = document.getElementById('userEmail');
const userButton = document.getElementById('userButton');
const dropdownMenu = document.getElementById('dropdownMenu');
const logoutButton = document.getElementById('logoutButton');
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

// Stats elements
const smtpStatusEl = document.getElementById('smtpStatus');
const totalCampaignsEl = document.getElementById('totalCampaigns');
const emailsSentEl = document.getElementById('emailsSent');
const emailsFailedEl = document.getElementById('emailsFailed');
const recentCampaignsEl = document.getElementById('recentCampaigns');

// ==================== User Dropdown ====================

// User dropdown toggle
userButton.addEventListener('click', (e) => {
  e.stopPropagation();
  const isVisible = dropdownMenu.style.display !== 'none';
  dropdownMenu.style.display = isVisible ? 'none' : 'block';
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
  dropdownMenu.style.display = 'none';
});

// Logout
logoutButton.addEventListener('click', () => {
  TokenManager.removeToken();
  window.location.href = '/index.html';
});

// ==================== Mobile Menu ====================

// Mobile menu toggle
hamburger.addEventListener('click', () => {
  navMenu.classList.toggle('active');
  hamburger.classList.toggle('active');
});

// ==================== Section Navigation ====================

// Get all navigation links and sections
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.content-section');
const actionButtons = document.querySelectorAll('.action-button');

// Handle navigation click
function navigateToSection(sectionId) {
  // Hide all sections
  sections.forEach(section => {
    section.classList.remove('active');
  });

  // Remove active class from all nav links
  navLinks.forEach(link => {
    link.classList.remove('active');
  });

  // Show target section
  const targetSection = document.getElementById(`${sectionId}-section`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Add active class to corresponding nav link
  const activeLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }

  // Close mobile menu
  navMenu.classList.remove('active');
  hamburger.classList.remove('active');
}

// Add click listeners to navigation links
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const section = link.getAttribute('data-section');
    navigateToSection(section);
    window.location.hash = `#${section}`;
  });
});

// Add click listeners to action buttons
actionButtons.forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const section = button.getAttribute('data-section');
    navigateToSection(section);
    window.location.hash = `#${section}`;
  });
});

// Handle hash navigation on page load
window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    navigateToSection(hash);
  }
});

// Handle browser back/forward
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    navigateToSection(hash);
  } else {
    navigateToSection('dashboard');
  }
});

// ==================== Dashboard Data Loading ====================

/**
 * Load dashboard data
 */
async function loadDashboard() {
  try {
    // Get user data
    const user = await API.getCurrentUser();
    if (user && user.email) {
      userEmailEl.textContent = user.email;
    }

    // Get dashboard stats
    const stats = await API.getDashboardStats();

    // Update stats
    if (stats) {
      // SMTP Status
      smtpStatusEl.textContent = stats.smtp_configured ? 'Configured ✓' : 'Not Configured';
      const smtpCard = smtpStatusEl.closest('.stat-card');
      smtpCard.classList.toggle('success', stats.smtp_configured);
      smtpCard.classList.toggle('error', !stats.smtp_configured);

      // Campaign stats
      totalCampaignsEl.textContent = stats.total_campaigns || 0;
      emailsSentEl.textContent = stats.total_sent || 0;
      emailsFailedEl.textContent = stats.total_failed || 0;

      // Load recent campaigns
      if (stats.recent_campaigns && stats.recent_campaigns.length > 0) {
        displayRecentCampaigns(stats.recent_campaigns);
      } else {
        recentCampaignsEl.innerHTML = '<p class="empty-state">No campaigns yet. Create your first campaign!</p>';
      }
    }
  } catch (error) {
    console.error('Failed to load dashboard:', error);

    // If 401, redirect to login
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      TokenManager.removeToken();
      window.location.href = '/index.html';
    } else {
      // Show error message in dashboard
      showDashboardError('Failed to load dashboard data. Please refresh the page.');
    }
  }
}

/**
 * Display recent campaigns
 * @param {Array} campaigns - Array of campaign objects
 */
function displayRecentCampaigns(campaigns) {
  recentCampaignsEl.innerHTML = campaigns.map(campaign => `
    <div class="campaign-item">
      <div class="campaign-info">
        <h3 class="campaign-name">${escapeHtml(campaign.name)}</h3>
        <p class="campaign-date">${formatDate(campaign.created_at)}</p>
      </div>
      <div class="campaign-stats">
        <span class="campaign-status ${getStatusClass(campaign.status)}">
          ${capitalizeFirst(campaign.status)}
        </span>
        <span class="campaign-progress">
          ${campaign.sent_count || 0} / ${campaign.recipient_count || 0}
        </span>
      </div>
    </div>
  `).join('');
}

/**
 * Show error message in dashboard
 * @param {string} message - Error message
 */
function showDashboardError(message) {
  const errorEl = document.createElement('div');
  errorEl.className = 'dashboard-error';
  errorEl.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
    </svg>
    <span>${message}</span>
  `;

  const dashboardHeader = document.querySelector('.dashboard-header');
  if (dashboardHeader && dashboardHeader.nextElementSibling) {
    dashboardHeader.parentNode.insertBefore(errorEl, dashboardHeader.nextElementSibling);
  }
}

// ==================== Helper Functions ====================

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format date string
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get CSS class for campaign status
 * @param {string} status - Campaign status
 * @returns {string} CSS class name
 */
function getStatusClass(status) {
  const statusMap = {
    'draft': 'status-draft',
    'sending': 'status-sending',
    'completed': 'status-completed',
    'failed': 'status-failed'
  };
  return statusMap[status.toLowerCase()] || '';
}

/**
 * Capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ==================== Initialize Dashboard ====================

// Load dashboard data on page load
loadDashboard();

// Expose loadDashboard globally for other modules to refresh dashboard
window.loadDashboard = loadDashboard;
