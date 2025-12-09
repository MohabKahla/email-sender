// API Integration Layer
// Handles all HTTP requests to the backend with JWT authentication

const API_BASE_URL = '/api';

const API = {
  /**
   * Helper to make authenticated requests
   * @param {string} url - API endpoint
   * @param {object} options - Fetch options
   * @returns {Promise} Response data
   */
  async request(url, options = {}) {
    const token = TokenManager.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Remove Content-Type for FormData requests
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        TokenManager.removeToken();
        window.location.href = '/index.html';
        throw new Error('Unauthorized - Please login again');
      }

      // Handle non-2xx responses
      if (!response.ok) {
        let errorMessage = 'Request failed';
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Parse and return JSON response
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  // ==================== Auth API ====================

  /**
   * Get current user information
   * @returns {Promise<Object>} User data
   */
  async getCurrentUser() {
    const response = await this.request('/auth/me');
    return response.user || response;
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

  // ==================== SMTP API ====================

  /**
   * Get SMTP configuration
   * @returns {Promise<Object>} SMTP config (password masked)
   */
  async getSmtpConfig() {
    return await this.request('/smtp/config');
  },

  /**
   * Save SMTP configuration
   * @param {Object} config - SMTP configuration
   * @param {string} config.gmail_address - Gmail email address
   * @param {string} config.app_password - Gmail app password
   * @param {string} config.from_name - From name for emails
   * @returns {Promise<Object>} Success response
   */
  async saveSmtpConfig(config) {
    return await this.request('/smtp/configure', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  },

  /**
   * Test SMTP connection
   * @param {Object} config - SMTP configuration to test
   * @returns {Promise<Object>} Test result
   */
  async testSmtpConnection(config) {
    return await this.request('/smtp/test', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  },

  // ==================== Campaign API ====================

  /**
   * Create a new campaign with CSV file
   * @param {FormData} formData - FormData with campaign details and CSV file
   * @returns {Promise<Object>} Created campaign
   */
  async createCampaign(formData) {
    const token = TokenManager.getToken();

    const response = await fetch(`${API_BASE_URL}/campaigns`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData // FormData includes file upload
    });

    if (response.status === 401) {
      TokenManager.removeToken();
      window.location.href = '/index.html';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      let errorMessage = 'Failed to create campaign';
      try {
        const error = await response.json();
        errorMessage = error.message || error.error || errorMessage;
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  },

  /**
   * Get list of campaigns
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 20)
   * @returns {Promise<Object>} Campaigns list with pagination
   */
  async getCampaigns(page = 1, limit = 20) {
    return await this.request(`/campaigns?page=${page}&limit=${limit}`);
  },

  /**
   * Get campaign by ID
   * @param {number} id - Campaign ID
   * @returns {Promise<Object>} Campaign details
   */
  async getCampaign(id) {
    return await this.request(`/campaigns/${id}`);
  },

  /**
   * Send campaign emails
   * @param {number} id - Campaign ID
   * @returns {Promise<Object>} Send result
   */
  async sendCampaign(id) {
    return await this.request(`/campaigns/${id}/send`, {
      method: 'POST'
    });
  },

  /**
   * Get campaign sending progress
   * @param {number} id - Campaign ID
   * @returns {Promise<Object>} Progress data
   */
  async getCampaignProgress(id) {
    return await this.request(`/campaigns/${id}/progress`);
  },

  /**
   * Get campaign email logs
   * @param {number} id - Campaign ID
   * @returns {Promise<Array>} Email logs
   */
  async getCampaignLogs(id) {
    return await this.request(`/campaigns/${id}/logs`);
  },

  /**
   * Delete campaign
   * @param {number} id - Campaign ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteCampaign(id) {
    return await this.request(`/campaigns/${id}`, {
      method: 'DELETE'
    });
  },

  // ==================== Dashboard API ====================

  /**
   * Get dashboard statistics
   * @returns {Promise<Object>} Dashboard stats
   */
  async getDashboardStats() {
    return await this.request('/dashboard/stats');
  }
};

// Export API object (for module systems)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
