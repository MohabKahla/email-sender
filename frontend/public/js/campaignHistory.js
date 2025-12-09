// Campaign History - View all campaigns with details

async function loadCampaignHistory() {
  const listEl = document.getElementById('campaignsList');
  if (!listEl) return;

  try {
    const response = await API.getCampaigns(1, 50);
    const campaigns = response.campaigns || [];

    if (campaigns.length === 0) {
      listEl.innerHTML = '<p class="empty-state">No campaigns yet. Create your first campaign!</p>';
      return;
    }

    listEl.innerHTML = `
      <table class="campaigns-table">
        <thead>
          <tr>
            <th>Campaign Name</th>
            <th>Date</th>
            <th>Recipients</th>
            <th>Sent</th>
            <th>Failed</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${campaigns.map(c => `
            <tr>
              <td><strong>${escapeHtml(c.name)}</strong></td>
              <td>${formatDate(c.created_at)}</td>
              <td>${c.total_recipients || 0}</td>
              <td class="text-success">${c.sent_count || 0}</td>
              <td class="text-error">${c.failed_count || 0}</td>
              <td><span class="status-badge status-${c.status}">${c.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    listEl.innerHTML = '<p class="text-error">Failed to load campaigns</p>';
    console.error('Load campaigns error:', error);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Load when campaigns section becomes active
const observer = new MutationObserver(() => {
  const campaignsSection = document.getElementById('campaigns-section');
  if (campaignsSection && campaignsSection.classList.contains('active')) {
    loadCampaignHistory();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const campaignsSection = document.getElementById('campaigns-section');
    if (campaignsSection) {
      observer.observe(campaignsSection, { attributes: true, attributeFilter: ['class'] });
    }
  });
} else {
  const campaignsSection = document.getElementById('campaigns-section');
  if (campaignsSection) {
    observer.observe(campaignsSection, { attributes: true, attributeFilter: ['class'] });
  }
}
