// SMTP Configuration Logic
// Handles SMTP configuration form, test connection, and save

// DOM Elements
const smtpConfigSection = document.getElementById('smtp-config-section');
const instructionsToggle = document.getElementById('instructionsToggle');
const instructionsContent = document.getElementById('instructionsContent');
const smtpConfigForm = document.getElementById('smtpConfigForm');
const gmailEmailInput = document.getElementById('gmailEmail');
const appPasswordInput = document.getElementById('appPassword');
const fromNameInput = document.getElementById('fromName');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const smtpMessages = document.getElementById('smtpMessages');

// Toggle instructions
if (instructionsToggle) {
  instructionsToggle.addEventListener('click', () => {
    const isVisible = instructionsContent.style.display !== 'none';
    instructionsContent.style.display = isVisible ? 'none' : 'block';
    const chevron = instructionsToggle.querySelector('.chevron-icon');
    if (chevron) {
      chevron.style.transform = isVisible ? '' : 'rotate(180deg)';
    }
  });
}

/**
 * Load current SMTP configuration
 */
async function loadSmtpConfig() {
  try {
    const config = await API.getSmtpConfig();

    if (config && config.config) {
      gmailEmailInput.value = config.config.gmail_address || '';
      fromNameInput.value = config.config.from_name || '';
      // Don't populate password for security
      appPasswordInput.placeholder = config.config.gmail_address ? 'Password saved (hidden)' : '16-character app password';
    }
  } catch (error) {
    console.error('Failed to load SMTP config:', error);
    // Don't show error if config doesn't exist yet
  }
}

/**
 * Test SMTP connection
 */
if (testConnectionBtn) {
  testConnectionBtn.addEventListener('click', async () => {
    // Clear previous messages
    smtpMessages.innerHTML = '';

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Show loading state
    setButtonLoading(testConnectionBtn, true);

    try {
      const config = {
        gmail_address: gmailEmailInput.value.trim(),
        app_password: appPasswordInput.value.trim(),
        from_name: fromNameInput.value.trim()
      };

      await API.testSmtpConnection(config);

      // Show success message
      showMessage('success', 'SMTP connection successful! You can now save the configuration.');
    } catch (error) {
      console.error('SMTP test failed:', error);
      showMessage('error', error.message || 'Failed to connect to SMTP server. Please check your credentials.');
    } finally {
      setButtonLoading(testConnectionBtn, false);
    }
  });
}

/**
 * Save SMTP configuration
 */
if (smtpConfigForm) {
  smtpConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous messages
    smtpMessages.innerHTML = '';

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Show loading state
    setButtonLoading(saveConfigBtn, true);

    try {
      const config = {
        gmail_address: gmailEmailInput.value.trim(),
        app_password: appPasswordInput.value.trim(),
        from_name: fromNameInput.value.trim()
      };

      await API.saveSmtpConfig(config);

      // Show success message
      showMessage('success', 'SMTP configuration saved successfully!');

      // Update dashboard SMTP status
      if (typeof loadDashboard === 'function') {
        loadDashboard();
      }

      // Clear password field
      appPasswordInput.value = '';
      appPasswordInput.placeholder = 'Password saved (hidden)';
    } catch (error) {
      console.error('Failed to save SMTP config:', error);
      showMessage('error', error.message || 'Failed to save SMTP configuration. Please try again.');
    } finally {
      setButtonLoading(saveConfigBtn, false);
    }
  });
}

/**
 * Form validation
 */
function validateForm() {
  let isValid = true;

  // Validate email
  const email = gmailEmailInput.value.trim();
  if (!email) {
    showFieldError('gmailEmailError', 'Email address is required');
    isValid = false;
  } else if (!isValidEmail(email)) {
    showFieldError('gmailEmailError', 'Please enter a valid email address');
    isValid = false;
  } else {
    clearFieldError('gmailEmailError');
  }

  // Validate app password
  const password = appPasswordInput.value.trim();
  if (!password && appPasswordInput.placeholder !== 'Password saved (hidden)') {
    showFieldError('appPasswordError', 'App password is required');
    isValid = false;
  } else if (password && password.length < 16) {
    showFieldError('appPasswordError', 'App password should be 16 characters');
    isValid = false;
  } else {
    clearFieldError('appPasswordError');
  }

  // Validate from name
  const fromName = fromNameInput.value.trim();
  if (!fromName) {
    showFieldError('fromNameError', 'From name is required');
    isValid = false;
  } else {
    clearFieldError('fromNameError');
  }

  return isValid;
}

/**
 * Helper functions
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(elementId, message) {
  const errorEl = document.getElementById(elementId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

function clearFieldError(elementId) {
  const errorEl = document.getElementById(elementId);
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }
}

function showMessage(type, message) {
  const messageEl = document.createElement('div');
  messageEl.className = `message message-${type}`;
  messageEl.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      ${type === 'success'
        ? '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>'
        : '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>'
      }
    </svg>
    <span>${message}</span>
  `;
  smtpMessages.appendChild(messageEl);

  // Auto-remove success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      messageEl.remove();
    }, 5000);
  }
}

function setButtonLoading(button, isLoading) {
  const textEl = button.querySelector('.btn-text');
  const spinnerEl = button.querySelector('.btn-spinner');

  if (isLoading) {
    button.disabled = true;
    if (textEl) textEl.style.display = 'none';
    if (spinnerEl) spinnerEl.style.display = 'inline-block';
  } else {
    button.disabled = false;
    if (textEl) textEl.style.display = 'inline';
    if (spinnerEl) spinnerEl.style.display = 'none';
  }
}

// Load config on page load
if (smtpConfigSection) {
  loadSmtpConfig();
}
