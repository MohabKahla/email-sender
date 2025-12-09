// Email Preview - List View with Edit Functionality
// Shows all email previews in cards with pagination, search, and individual editing

let previewState = {
  recipients: [],
  subject: '',
  body: '',
  currentPage: 1,
  perPage: 50,
  searchQuery: '',
  filterCustomized: 'all', // 'all', 'customized', 'original'
  searchTimeout: null,
  searchInputHadFocus: false
};

/**
 * Show email preview list
 * @param {string} subject - Email subject template
 * @param {string} body - Email body template
 * @param {Array} recipients - Array of recipient data objects
 */
function showEmailPreview(subject, body, recipients) {
  if (!recipients || recipients.length === 0) {
    alert('No recipients to preview');
    return;
  }

  previewState.recipients = recipients;
  previewState.subject = subject;
  previewState.body = body;
  previewState.currentPage = 1;
  previewState.searchQuery = '';
  previewState.filterCustomized = 'all';

  renderEmailPreviewList();
}

/**
 * Render the email preview list container
 */
function renderEmailPreviewList() {
  // Remove existing preview if any
  let container = document.getElementById('emailPreviewListContainer');
  if (container) {
    container.remove();
  }

  // Create container
  container = document.createElement('div');
  container.id = 'emailPreviewListContainer';
  container.className = 'email-preview-list-container';

  // Insert after the campaign form (outside the form to prevent form submission)
  const campaignForm = document.getElementById('campaignForm');
  if (campaignForm && campaignForm.parentNode) {
    campaignForm.parentNode.insertBefore(container, campaignForm.nextSibling);
  } else {
    document.body.appendChild(container);
  }

  updateEmailPreviewList();
}

/**
 * Update the email preview list content
 */
function updateEmailPreviewList() {
  const container = document.getElementById('emailPreviewListContainer');
  if (!container) return;

  // Track if search input has focus before re-rendering
  const searchInput = document.getElementById('previewSearchInput');
  previewState.searchInputHadFocus = searchInput && document.activeElement === searchInput;

  const filtered = getFilteredRecipients();
  const paginated = getPaginatedRecipients(filtered);
  const totalPages = Math.ceil(filtered.length / previewState.perPage);
  const customizedCount = previewState.recipients.filter(r => r._customized).length;

  container.innerHTML = `
    <div class="preview-list-header">
      <div class="preview-stats">
        <h3>Email Preview (${filtered.length} recipients)</h3>
        <div class="stats-badges">
          <span class="badge badge-info">Total: ${previewState.recipients.length}</span>
          <span class="badge badge-success">Customized: ${customizedCount}</span>
          <span class="badge badge-warning">Original: ${previewState.recipients.length - customizedCount}</span>
        </div>
      </div>

      <div class="preview-controls">
        <div class="search-box">
          <input
            type="text"
            id="previewSearchInput"
            placeholder="Search by email, name..."
            value="${escapeHtml(previewState.searchQuery)}"
            class="search-input"
          />
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
          </svg>
        </div>

        <select id="previewFilterSelect" class="filter-select">
          <option value="all" ${previewState.filterCustomized === 'all' ? 'selected' : ''}>All Emails</option>
          <option value="customized" ${previewState.filterCustomized === 'customized' ? 'selected' : ''}>Customized Only</option>
          <option value="original" ${previewState.filterCustomized === 'original' ? 'selected' : ''}>Original Only</option>
        </select>
      </div>
    </div>

    <div class="preview-table-container">
      ${paginated.length > 0
        ? renderEmailTable(paginated)
        : '<p class="empty-state">No emails match your search</p>'
      }
    </div>

    ${totalPages > 1 ? renderPagination(totalPages) : ''}
  `;

  // Attach event listeners
  attachPreviewListeners();
}

/**
 * Render email preview table
 */
function renderEmailTable(paginated) {
  return `
    <table class="preview-table">
      <thead>
        <tr>
          <th>Recipient</th>
          <th>Subject</th>
          <th>Preview</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${paginated.map((recipient, idx) => renderEmailRow(recipient, idx)).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Render a single email table row
 */
function renderEmailRow(recipient, index) {
  const personalizedSubject = replaceVariables(
    recipient._customSubject || previewState.subject,
    recipient
  );
  const personalizedBody = replaceVariables(
    recipient._customBody || previewState.body,
    recipient
  );
  const isCustomized = recipient._customized || false;
  const bodyPreview = personalizedBody.substring(0, 80) + (personalizedBody.length > 80 ? '...' : '');

  return `
    <tr class="email-row ${isCustomized ? 'customized-row' : ''}">
      <td class="recipient-cell">
        <div class="recipient-email">${escapeHtml(recipient.email || recipient.Email || 'N/A')}</div>
        <div class="recipient-name">${escapeHtml(recipient.name || recipient.Name || 'No name')}</div>
      </td>
      <td class="subject-cell">${escapeHtml(personalizedSubject)}</td>
      <td class="preview-cell">${escapeHtml(bodyPreview)}</td>
      <td class="status-cell">
        ${isCustomized ? '<span class="badge badge-custom">Customized</span>' : '<span class="badge badge-original">Original</span>'}
      </td>
      <td class="actions-cell">
        <button type="button" class="btn-table-action btn-edit" onclick="openEditEmailModal(${index})" title="Edit">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
          </svg>
        </button>
        <button type="button" class="btn-table-action btn-view" onclick="viewFullEmail(${index})" title="View">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
          </svg>
        </button>
        ${isCustomized ? `
          <button type="button" class="btn-table-action btn-reset" onclick="resetEmailCustomization(${index})" title="Reset">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
            </svg>
          </button>
        ` : ''}
      </td>
    </tr>
  `;
}

/**
 * Render a single email preview card (legacy, kept for reference)
 */
function renderEmailCard(recipient, index) {
  const personalizedSubject = replaceVariables(
    recipient._customSubject || previewState.subject,
    recipient
  );
  const personalizedBody = replaceVariables(
    recipient._customBody || previewState.body,
    recipient
  );
  const isCustomized = recipient._customized || false;
  const bodyPreview = personalizedBody.substring(0, 150) + (personalizedBody.length > 150 ? '...' : '');

  return `
    <div class="email-card ${isCustomized ? 'customized' : ''}" data-index="${index}">
      <div class="email-card-header">
        <div class="recipient-info">
          <div class="recipient-email">${escapeHtml(recipient.email || recipient.Email || 'N/A')}</div>
          <div class="recipient-name">${escapeHtml(recipient.name || recipient.Name || 'No name')}</div>
        </div>
        ${isCustomized ? '<span class="badge badge-custom">Customized</span>' : ''}
      </div>

      <div class="email-card-body">
        <div class="email-subject">
          <strong>Subject:</strong> ${escapeHtml(personalizedSubject)}
        </div>
        <div class="email-body-preview">
          ${escapeHtml(bodyPreview).replace(/\n/g, '<br>')}
        </div>
      </div>

      <div class="email-card-footer">
        <button class="btn-card-action btn-edit" onclick="openEditEmailModal(${index})">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
          </svg>
          Edit
        </button>
        <button class="btn-card-action btn-view" onclick="viewFullEmail(${index})">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
          </svg>
          View
        </button>
        ${isCustomized ? `
          <button class="btn-card-action btn-reset" onclick="resetEmailCustomization(${index})">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
            </svg>
            Reset
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render pagination controls
 */
function renderPagination(totalPages) {
  const currentPage = previewState.currentPage;
  const pages = [];

  // Always show first page
  pages.push(1);

  // Show pages around current page
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    if (!pages.includes(i)) pages.push(i);
  }

  // Always show last page
  if (!pages.includes(totalPages)) pages.push(totalPages);

  return `
    <div class="preview-pagination">
      <button
        type="button"
        class="btn-pagination"
        ${currentPage === 1 ? 'disabled' : ''}
        onclick="changePreviewPage(${currentPage - 1})"
      >
        Previous
      </button>

      <div class="pagination-numbers">
        ${pages.map((page, idx) => {
          const prevPage = pages[idx - 1];
          const showEllipsis = prevPage && page - prevPage > 1;
          return `
            ${showEllipsis ? '<span class="pagination-ellipsis">...</span>' : ''}
            <button
              type="button"
              class="btn-page ${page === currentPage ? 'active' : ''}"
              onclick="changePreviewPage(${page})"
            >
              ${page}
            </button>
          `;
        }).join('')}
      </div>

      <button
        type="button"
        class="btn-pagination"
        ${currentPage === totalPages ? 'disabled' : ''}
        onclick="changePreviewPage(${currentPage + 1})"
      >
        Next
      </button>
    </div>
  `;
}

/**
 * Attach event listeners to preview controls
 */
function attachPreviewListeners() {
  const searchInput = document.getElementById('previewSearchInput');
  if (searchInput) {
    // Restore focus and cursor position if input had focus before re-render
    if (previewState.searchInputHadFocus) {
      searchInput.focus();
      const length = searchInput.value.length;
      searchInput.setSelectionRange(length, length);
      previewState.searchInputHadFocus = false; // Reset flag
    }

    searchInput.addEventListener('input', (e) => {
      const value = e.target.value;

      // Clear previous timeout
      if (previewState.searchTimeout) {
        clearTimeout(previewState.searchTimeout);
      }

      // Update search query immediately for input value
      previewState.searchQuery = value;

      // Debounce the actual search/re-render
      previewState.searchTimeout = setTimeout(() => {
        previewState.currentPage = 1;
        updateEmailPreviewList();
      }, 300); // Wait 300ms after user stops typing
    });
  }

  const filterSelect = document.getElementById('previewFilterSelect');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      previewState.filterCustomized = e.target.value;
      previewState.currentPage = 1;
      updateEmailPreviewList();
    });
  }
}

/**
 * Get filtered recipients based on search and filter
 */
function getFilteredRecipients() {
  let filtered = [...previewState.recipients];

  // Apply search
  if (previewState.searchQuery) {
    const query = previewState.searchQuery.toLowerCase();
    filtered = filtered.filter(r => {
      const email = (r.email || r.Email || '').toLowerCase();
      const name = (r.name || r.Name || '').toLowerCase();
      return email.includes(query) || name.includes(query);
    });
  }

  // Apply filter
  if (previewState.filterCustomized === 'customized') {
    filtered = filtered.filter(r => r._customized);
  } else if (previewState.filterCustomized === 'original') {
    filtered = filtered.filter(r => !r._customized);
  }

  return filtered;
}

/**
 * Get paginated recipients
 */
function getPaginatedRecipients(filtered) {
  const start = (previewState.currentPage - 1) * previewState.perPage;
  const end = start + previewState.perPage;
  return filtered.slice(start, end);
}

/**
 * Change preview page
 */
function changePreviewPage(page) {
  const filtered = getFilteredRecipients();
  const totalPages = Math.ceil(filtered.length / previewState.perPage);

  if (page < 1 || page > totalPages) return;

  previewState.currentPage = page;
  updateEmailPreviewList();

  // Scroll to top of preview list
  const container = document.getElementById('emailPreviewListContainer');
  if (container) {
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Open edit modal for specific email
 */
function openEditEmailModal(index) {
  const filtered = getFilteredRecipients();
  const recipient = filtered[index];
  if (!recipient) return;

  // Find actual index in full recipients array
  const actualIndex = previewState.recipients.indexOf(recipient);

  createEditEmailModal(actualIndex);
}

/**
 * Create and show edit modal
 */
function createEditEmailModal(recipientIndex) {
  const recipient = previewState.recipients[recipientIndex];
  if (!recipient) return;

  // Remove existing modal
  const existing = document.getElementById('editEmailModal');
  if (existing) existing.remove();

  const currentSubject = recipient._customSubject || previewState.subject;
  const currentBody = recipient._customBody || previewState.body;
  const personalizedSubject = replaceVariables(currentSubject, recipient);
  const personalizedBody = replaceVariables(currentBody, recipient);

  const modal = document.createElement('div');
  modal.id = 'editEmailModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container modal-large">
      <div class="modal-header">
        <h3 class="modal-title">Edit Email for ${escapeHtml(recipient.email || 'Recipient')}</h3>
        <button type="button" class="modal-close" onclick="closeEditEmailModal()">
          <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="edit-form">
          <div class="form-section">
            <h4>Recipient Information</h4>
            <div class="recipient-fields">
              <div class="form-group">
                <label>Email</label>
                <input type="email" id="editRecipientEmail" value="${escapeHtml(recipient.email || recipient.Email || '')}" class="form-input" />
              </div>
              <div class="form-group">
                <label>Name</label>
                <input type="text" id="editRecipientName" value="${escapeHtml(recipient.name || recipient.Name || '')}" class="form-input" />
              </div>
            </div>
          </div>

          <div class="form-section">
            <h4>Email Content</h4>
            <div class="form-group">
              <label>Subject Line</label>
              <input type="text" id="editEmailSubject" value="${escapeHtml(currentSubject)}" class="form-input" />
              <small class="form-hint">Use {{variable}} syntax for personalization</small>
            </div>

            <div class="form-group">
              <label>Email Body</label>
              <textarea id="editEmailBody" rows="10" class="form-textarea">${escapeHtml(currentBody)}</textarea>
              <small class="form-hint">Use {{variable}} syntax for personalization</small>
            </div>
          </div>

          <div class="form-section">
            <h4>Preview (with variables replaced)</h4>
            <div class="preview-box">
              <div class="preview-subject">
                <strong>Subject:</strong> <span id="editPreviewSubject">${escapeHtml(personalizedSubject)}</span>
              </div>
              <div class="preview-body" id="editPreviewBody">
                ${escapeHtml(personalizedBody).replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeEditEmailModal()">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="saveEmailCustomization(${recipientIndex})">Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add real-time preview update
  const subjectInput = document.getElementById('editEmailSubject');
  const bodyInput = document.getElementById('editEmailBody');

  const updatePreview = () => {
    const newSubject = replaceVariables(subjectInput.value, recipient);
    const newBody = replaceVariables(bodyInput.value, recipient);
    document.getElementById('editPreviewSubject').textContent = newSubject;
    document.getElementById('editPreviewBody').innerHTML = escapeHtml(newBody).replace(/\n/g, '<br>');
  };

  subjectInput.addEventListener('input', updatePreview);
  bodyInput.addEventListener('input', updatePreview);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeEditEmailModal();
  });

  // Close on Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') closeEditEmailModal();
  };
  document.addEventListener('keydown', handleEscape);
  modal._handleEscape = handleEscape;
}

/**
 * Close edit modal
 */
function closeEditEmailModal() {
  const modal = document.getElementById('editEmailModal');
  if (modal) {
    if (modal._handleEscape) {
      document.removeEventListener('keydown', modal._handleEscape);
    }
    modal.remove();
  }
}

/**
 * Save email customization
 */
function saveEmailCustomization(recipientIndex) {
  const recipient = previewState.recipients[recipientIndex];
  if (!recipient) return;

  const newEmail = document.getElementById('editRecipientEmail').value.trim();
  const newName = document.getElementById('editRecipientName').value.trim();
  const newSubject = document.getElementById('editEmailSubject').value;
  const newBody = document.getElementById('editEmailBody').value;

  // Update recipient data
  recipient.email = newEmail;
  recipient.Email = newEmail; // Support both cases
  recipient.name = newName;
  recipient.Name = newName;

  // Check if subject or body was customized
  const subjectChanged = newSubject !== previewState.subject;
  const bodyChanged = newBody !== previewState.body;

  if (subjectChanged || bodyChanged) {
    recipient._customized = true;
    if (subjectChanged) recipient._customSubject = newSubject;
    if (bodyChanged) recipient._customBody = newBody;
  } else {
    // If reverted to original, remove customization
    recipient._customized = false;
    delete recipient._customSubject;
    delete recipient._customBody;
  }

  // Update csvData in campaignBuilder
  if (typeof csvData !== 'undefined') {
    csvData = previewState.recipients;
  }

  closeEditEmailModal();
  updateEmailPreviewList();

  showFlashMessage('Email customization saved successfully');
}

/**
 * View full email in modal
 */
function viewFullEmail(index) {
  const filtered = getFilteredRecipients();
  const recipient = filtered[index];
  if (!recipient) return;

  // Find actual index in full recipients array
  const actualIndex = previewState.recipients.indexOf(recipient);

  const personalizedSubject = replaceVariables(
    recipient._customSubject || previewState.subject,
    recipient
  );
  const personalizedBody = replaceVariables(
    recipient._customBody || previewState.body,
    recipient
  );

  // Remove existing modal
  const existing = document.getElementById('viewEmailModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'viewEmailModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Email Preview</h3>
        <button type="button" class="modal-close" onclick="closeViewEmailModal()">
          <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="email-view">
          <div class="email-field">
            <strong>To:</strong> ${escapeHtml(recipient.email || recipient.Email || 'N/A')}
          </div>
          <div class="email-field">
            <strong>Subject:</strong> ${escapeHtml(personalizedSubject)}
          </div>
          <div class="email-field">
            <strong>Message:</strong>
            <div class="email-body-full">${escapeHtml(personalizedBody).replace(/\n/g, '<br>')}</div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeViewEmailModal()">Close</button>
        <button type="button" class="btn btn-primary" onclick="closeViewEmailModal(); openEditEmailModal(${actualIndex});">Edit Email</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeViewEmailModal();
  });
}

/**
 * Close view modal
 */
function closeViewEmailModal() {
  const modal = document.getElementById('viewEmailModal');
  if (modal) modal.remove();
}

/**
 * Reset email customization
 */
function resetEmailCustomization(index) {
  if (!confirm('Reset this email to the original template?')) return;

  const filtered = getFilteredRecipients();
  const recipient = filtered[index];
  if (!recipient) return;

  // Find actual index
  const actualIndex = previewState.recipients.indexOf(recipient);
  const actualRecipient = previewState.recipients[actualIndex];

  // Remove customization
  actualRecipient._customized = false;
  delete actualRecipient._customSubject;
  delete actualRecipient._customBody;

  // Update csvData
  if (typeof csvData !== 'undefined') {
    csvData = previewState.recipients;
  }

  updateEmailPreviewList();
  showFlashMessage('Email reset to original template');
}

/**
 * Replace template variables with recipient data
 */
function replaceVariables(template, recipient) {
  let result = template;
  Object.keys(recipient).forEach(key => {
    if (!key.startsWith('_')) { // Skip internal fields
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      result = result.replace(regex, recipient[key] || '');
    }
  });
  return result;
}

/**
 * Show flash message
 */
function showFlashMessage(message) {
  const flash = document.createElement('div');
  flash.className = 'flash-message';
  flash.textContent = message;
  document.body.appendChild(flash);

  setTimeout(() => {
    flash.classList.add('show');
  }, 10);

  setTimeout(() => {
    flash.classList.remove('show');
    setTimeout(() => flash.remove(), 300);
  }, 2000);
}

/**
 * Helper to escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Close preview list (for legacy compatibility)
 */
function closeEmailPreview() {
  const container = document.getElementById('emailPreviewListContainer');
  if (container) container.remove();
}

/**
 * Get customization summary for campaign creation
 */
function getCustomizationSummary() {
  const customized = previewState.recipients.filter(r => r._customized);
  return {
    total: previewState.recipients.length,
    customized: customized.length,
    recipients: previewState.recipients
  };
}
