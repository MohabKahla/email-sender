// Campaign Builder - CSV Upload and Template Builder
// Complete implementation with drag-drop, preview, and send

let csvData = [];
let csvHeaders = [];
let currentFile = null;

// DOM Elements
const initCampaignBuilder = () => {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('csvFileInput');
  const previewBtn = document.getElementById('previewEmailsBtn');

  if (!dropZone || !fileInput) return;

  // Drag and drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  // Preview emails button
  if (previewBtn) {
    previewBtn.addEventListener('click', previewEmails);
  }
};

function handleFiles(files) {
  if (!files.length) return;

  const file = files[0];
  if (!file.name.endsWith('.csv')) {
    alert('Please upload a CSV file');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('File must be less than 5MB');
    return;
  }

  currentFile = file;
  parseCSV(file);
}

function parseCSV(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
      alert('CSV needs header + data rows');
      return;
    }

    csvHeaders = lines[0].split(',').map(h => h.trim());
    csvData = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const row = {};
      csvHeaders.forEach((h, i) => row[h] = vals[i] || '');
      return row;
    });

    displayCSVPreview();
    displayVariableTags();
  };
  reader.readAsText(file);
}

function displayCSVPreview() {
  const preview = csvData.slice(0, 5);
  const previewEl = document.getElementById('csvPreview');

  previewEl.innerHTML = '<p>CSV Preview (first 5 of ' + csvData.length + '):</p>' +
    '<div class="table-wrapper"><table class="csv-table"><thead><tr>' +
    csvHeaders.map(h => '<th>' + h + '</th>').join('') +
    '</tr></thead><tbody>' +
    preview.map(row => '<tr>' + csvHeaders.map(h => '<td>' + (row[h] || '') + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
}

function displayVariableTags() {
  const tagsEl = document.getElementById('variableTags');
  tagsEl.innerHTML = '<p>Available Variables:</p><div class="tags-container">' +
    csvHeaders.map(h => '<button type="button" class="variable-tag" onclick="copyVar(\'' + h + '\')">{{' + h + '}}</button>').join('') +
    '</div>';
}

function copyVar(name) {
  const tag = '{{' + name + '}}';
  navigator.clipboard.writeText(tag);
  showMsg('Copied: ' + tag);
}

function showMsg(text) {
  const msg = document.createElement('div');
  msg.className = 'flash-msg';
  msg.textContent = text;
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 2000);
}

function previewEmails() {
  if (!currentFile || csvData.length === 0) {
    alert('Please upload a CSV file first');
    return;
  }

  const subject = document.getElementById('emailSubject').value.trim();
  const body = document.getElementById('emailBody').value.trim();

  if (!subject || !body) {
    alert('Please fill in subject and email body');
    return;
  }

  // Update csvData reference for email preview
  window.csvData = csvData;

  // Call the showEmailPreview function from emailPreview.js
  if (typeof showEmailPreview === 'function') {
    showEmailPreview(subject, body, csvData);
  } else {
    alert('Email preview functionality not available');
  }
}

function syncPreviewData() {
  // Sync data back from preview state if it exists
  if (typeof previewState !== 'undefined' && previewState.recipients && previewState.recipients.length > 0) {
    csvData = previewState.recipients;
  }
}

function generateUpdatedCSV(data, headers) {
  // Generate CSV content from updated data
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header] || row[header.toLowerCase()] || '';
      // Escape values that contain commas, quotes, or newlines
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  const csvContent = [csvHeaders, ...csvRows].join('\n');

  // Create a Blob and File from the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv' });
  return new File([blob], 'updated_recipients.csv', { type: 'text/csv' });
}

async function createAndSendCampaign() {
  // Sync any preview customizations first
  syncPreviewData();

  if (!currentFile || csvData.length === 0) {
    alert('Please upload CSV first');
    return;
  }

  const name = document.getElementById('campaignName').value.trim();
  const subject = document.getElementById('emailSubject').value.trim();
  const body = document.getElementById('emailBody').value.trim();

  if (!name || !subject || !body) {
    alert('Fill all fields');
    return;
  }

  const btn = document.getElementById('sendCampaignBtn');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    // Check if any emails were customized
    const hasCustomizations = csvData.some(r => r._customized);

    // Generate updated CSV if there are customizations
    let fileToUpload = currentFile;
    if (hasCustomizations) {
      fileToUpload = generateUpdatedCSV(csvData, csvHeaders);
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('subject', subject);
    formData.append('email_body', body);
    formData.append('recipientsFile', fileToUpload);

    // Add customization metadata
    if (hasCustomizations) {
      formData.append('has_customizations', 'true');
      formData.append('customizations', JSON.stringify(
        csvData.filter(r => r._customized).map(r => ({
          email: r.email || r.Email,
          customSubject: r._customSubject,
          customBody: r._customBody
        }))
      ));
    }

    const result = await API.createCampaign(formData);
    const campaignId = result.campaign.id;

    // Start sending
    btn.textContent = 'Sending...';
    await API.sendCampaign(campaignId);

    // Show progress modal
    if (typeof showSendingProgress === 'function') {
      showSendingProgress(campaignId);
    }

    // Reset form and preview
    document.getElementById('campaignForm').reset();
    csvData = [];
    csvHeaders = [];
    currentFile = null;
    document.getElementById('csvPreview').innerHTML = '';
    document.getElementById('variableTags').innerHTML = '';

    // Clear email preview list
    if (typeof closeEmailPreview === 'function') {
      closeEmailPreview();
    }

    if (typeof loadDashboard === 'function') loadDashboard();
  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create & Send';
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCampaignBuilder);
} else {
  initCampaignBuilder();
}
