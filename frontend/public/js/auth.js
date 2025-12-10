// =======================
// Configuration
// =======================
const API_BASE_URL = '/api';

// =======================
// JWT Token Management
// =======================


// =======================
// API Service
// =======================
const API = {
  /**
   * Make API request
   * @param {string} endpoint - API endpoint
   * @param {object} options - Fetch options
   * @returns {Promise<object>} Response data
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = TokenManager.getToken();

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  },

  /**
   * Register new user
   * @param {object} userData - User data
   * @returns {Promise<object>} Response data
   */
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  /**
   * Login user
   * @param {object} credentials - Login credentials
   * @returns {Promise<object>} Response data
   */
  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  },

  /**
   * Get current user
   * @returns {Promise<object>} User data
   */
  async getCurrentUser() {
    return this.request('/auth/me');
  }
};

// =======================
// Form Validation
// =======================
const Validator = {
  /**
   * Validate email format
   * @param {string} email - Email address
   * @returns {boolean} True if valid
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate password strength
   * @param {string} password - Password
   * @returns {object} Validation result
   */
  validatePassword(password) {
    const result = {
      valid: false,
      strength: 'weak',
      errors: []
    };

    if (!password) {
      result.errors.push('Password is required');
      return result;
    }

    if (password.length < 8) {
      result.errors.push('Password must be at least 8 characters');
      return result;
    }

    // Check password strength
    let strength = 0;

    // Length check
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;

    // Complexity checks
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) {
      result.strength = 'weak';
      result.color = '#ef4444';
      result.width = '33%';
    } else if (strength <= 4) {
      result.strength = 'medium';
      result.color = '#f59e0b';
      result.width = '66%';
    } else {
      result.strength = 'strong';
      result.color = '#10b981';
      result.width = '100%';
    }

    result.valid = strength >= 3;
    return result;
  },

  /**
   * Validate full name
   * @param {string} name - Full name
   * @returns {string|null} Error message or null
   */
  validateFullName(name) {
    if (!name || name.trim().length < 2) {
      return 'Full name must be at least 2 characters';
    }
    if (name.length > 100) {
      return 'Full name must be less than 100 characters';
    }
    return null;
  }
};

// =======================
// UI Controller
// =======================
const UI = {
  /**
   * Show error message for input field
   * @param {string} fieldId - Input field ID
   * @param {string} message - Error message
   */
  showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorElement = document.getElementById(`${fieldId}Error`);

    if (input) {
      input.classList.add('error');
      input.classList.remove('success');
    }

    if (errorElement) {
      errorElement.textContent = message;
    }
  },

  /**
   * Clear error message for input field
   * @param {string} fieldId - Input field ID
   */
  clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errorElement = document.getElementById(`${fieldId}Error`);

    if (input) {
      input.classList.remove('error');
    }

    if (errorElement) {
      errorElement.textContent = '';
    }
  },

  /**
   * Mark field as success
   * @param {string} fieldId - Input field ID
   */
  markFieldSuccess(fieldId) {
    const input = document.getElementById(fieldId);
    if (input) {
      input.classList.add('success');
      input.classList.remove('error');
    }
  },

  /**
   * Show form alert
   * @param {string} formType - 'login' or 'register'
   * @param {string} message - Alert message
   * @param {string} type - 'error' or 'success'
   */
  showAlert(formType, message, type = 'error') {
    const alertElement = document.getElementById(`${formType}Alert`);
    if (alertElement) {
      alertElement.textContent = message;
      alertElement.className = `form-alert ${type} show`;
    }
  },

  /**
   * Hide form alert
   * @param {string} formType - 'login' or 'register'
   */
  hideAlert(formType) {
    const alertElement = document.getElementById(`${formType}Alert`);
    if (alertElement) {
      alertElement.className = 'form-alert';
    }
  },

  /**
   * Set button loading state
   * @param {string} buttonId - Button ID
   * @param {boolean} loading - Loading state
   */
  setButtonLoading(buttonId, loading) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    const text = button.querySelector('.btn-text');
    const loader = button.querySelector('.btn-loader');

    if (loading) {
      button.disabled = true;
      if (text) text.style.display = 'none';
      if (loader) loader.style.display = 'inline-flex';
    } else {
      button.disabled = false;
      if (text) text.style.display = 'inline';
      if (loader) loader.style.display = 'none';
    }
  },

  /**
   * Update password strength indicator
   * @param {object} strength - Strength object
   */
  updatePasswordStrength(strength) {
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');

    if (strengthBar && strength) {
      strengthBar.style.setProperty('--strength-width', strength.width || '0%');
      strengthBar.style.setProperty('--strength-color', strength.color || '#e5e7eb');
    }

    if (strengthText && strength) {
      strengthText.textContent = strength.strength
        ? `Password strength: ${strength.strength.charAt(0).toUpperCase() + strength.strength.slice(1)}`
        : '';
    }
  }
};

// =======================
// Auth Controller
// =======================
const Auth = {
  /**
   * Handle login form submission
   * @param {Event} event - Form submit event
   */
  async handleLogin(event) {
    event.preventDefault();
    UI.hideAlert('login');

    // Get form data
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Clear previous errors
    UI.clearFieldError('loginEmail');
    UI.clearFieldError('loginPassword');

    // Validate email
    if (!email) {
      UI.showFieldError('loginEmail', 'Email is required');
      return;
    }

    if (!Validator.isValidEmail(email)) {
      UI.showFieldError('loginEmail', 'Please enter a valid email address');
      return;
    }

    // Validate password
    if (!password) {
      UI.showFieldError('loginPassword', 'Password is required');
      return;
    }

    // Show loading state
    UI.setButtonLoading('loginBtn', true);

    try {
      // Call login API
      const response = await API.login({ email, password });

      // Store token
      if (response.token) {
        TokenManager.setToken(response.token);
      }

      // Show success message
      UI.showAlert('login', 'Login successful! Redirecting...', 'success');

      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1000);
    } catch (error) {
      console.error('Login error:', error);
      UI.showAlert('login', error.message || 'Login failed. Please check your credentials.', 'error');
    } finally {
      UI.setButtonLoading('loginBtn', false);
    }
  },

  /**
   * Handle register form submission
   * @param {Event} event - Form submit event
   */
  async handleRegister(event) {
    event.preventDefault();
    UI.hideAlert('register');

    // Get form data
    const fullName = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    // Clear previous errors
    UI.clearFieldError('registerName');
    UI.clearFieldError('registerEmail');
    UI.clearFieldError('registerPassword');
    UI.clearFieldError('registerConfirmPassword');

    let hasErrors = false;

    // Validate full name
    const nameError = Validator.validateFullName(fullName);
    if (nameError) {
      UI.showFieldError('registerName', nameError);
      hasErrors = true;
    }

    // Validate email
    if (!email) {
      UI.showFieldError('registerEmail', 'Email is required');
      hasErrors = true;
    } else if (!Validator.isValidEmail(email)) {
      UI.showFieldError('registerEmail', 'Please enter a valid email address');
      hasErrors = true;
    }

    // Validate password
    const passwordValidation = Validator.validatePassword(password);
    if (!passwordValidation.valid) {
      UI.showFieldError('registerPassword', passwordValidation.errors[0] || 'Password is too weak');
      hasErrors = true;
    }

    // Validate password confirmation
    if (!confirmPassword) {
      UI.showFieldError('registerConfirmPassword', 'Please confirm your password');
      hasErrors = true;
    } else if (password !== confirmPassword) {
      UI.showFieldError('registerConfirmPassword', 'Passwords do not match');
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    // Show loading state
    UI.setButtonLoading('registerBtn', true);

    try {
      // Call register API
      const response = await API.register({
        full_name: fullName,
        email,
        password
      });

      // Show success message
      UI.showAlert('register', 'Registration successful! Please sign in.', 'success');

      // Switch to login form after 2 seconds
      setTimeout(() => {
        Auth.toggleForms('login');

        // Pre-fill email in login form
        document.getElementById('loginEmail').value = email;
      }, 2000);
    } catch (error) {
      console.error('Registration error:', error);
      UI.showAlert('register', error.message || 'Registration failed. Please try again.', 'error');
    } finally {
      UI.setButtonLoading('registerBtn', false);
    }
  },

  /**
   * Toggle between login and register forms
   * @param {string} form - 'login' or 'register'
   */
  toggleForms(form) {
    const loginCard = document.getElementById('loginCard');
    const registerCard = document.getElementById('registerCard');

    if (form === 'register') {
      loginCard.style.display = 'none';
      registerCard.style.display = 'block';
      UI.hideAlert('login');
    } else {
      loginCard.style.display = 'block';
      registerCard.style.display = 'none';
      UI.hideAlert('register');
    }
  }
};

// =======================
// Event Listeners
// =======================
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', Auth.handleLogin);
  }

  // Register form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', Auth.handleRegister);
  }

  // Toggle forms
  const showRegisterLink = document.getElementById('showRegister');
  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      Auth.toggleForms('register');
    });
  }

  const showLoginLink = document.getElementById('showLogin');
  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      Auth.toggleForms('login');
    });
  }

  // Password strength indicator
  const registerPassword = document.getElementById('registerPassword');
  if (registerPassword) {
    registerPassword.addEventListener('input', (e) => {
      const strength = Validator.validatePassword(e.target.value);
      UI.updatePasswordStrength(strength);
    });
  }

  // Real-time validation
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('blur', () => {
      // Clear error on blur if field is valid
      const value = input.value.trim();

      if (input.type === 'email' && value) {
        if (Validator.isValidEmail(value)) {
          UI.clearFieldError(input.id);
          UI.markFieldSuccess(input.id);
        }
      }

      if (input.id === 'registerConfirmPassword' && value) {
        const password = document.getElementById('registerPassword').value;
        if (value === password) {
          UI.clearFieldError(input.id);
          UI.markFieldSuccess(input.id);
        }
      }
    });

    input.addEventListener('focus', () => {
      // Clear error styling on focus
      UI.clearFieldError(input.id);
    });
  });

  // Check if already authenticated (do this last to not block event listeners)
  if (TokenManager.isAuthenticated()) {
    API.getCurrentUser()
      .then(() => {
        // If token is valid and we are not on dashboard, redirect
        if (!window.location.pathname.includes('dashboard.html')) {
          window.location.href = '/dashboard.html';
        }
      })
      .catch((error) => {
        console.warn('Token invalid or expired:', error);
        TokenManager.removeToken();
        // Stay on login page
      });
  }
});
