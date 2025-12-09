// =======================
// JWT Token Management
// =======================
const TokenManager = {
  /**
   * Store JWT token in localStorage
   * @param {string} token - JWT token
   */
  setToken(token) {
    localStorage.setItem('jwt_token', token);
  },

  /**
   * Get JWT token from localStorage
   * @returns {string|null} JWT token or null
   */
  getToken() {
    return localStorage.getItem('jwt_token');
  },

  /**
   * Remove JWT token from localStorage
   */
  removeToken() {
    localStorage.removeItem('jwt_token');
  },

  /**
   * Check if user is authenticated
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  }
};

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TokenManager;
}
