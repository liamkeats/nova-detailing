(() => {
  const state = {
    overview: null,
    search: '',
    status: '',
    source: '',
    payment: '',
  };

  const elements = {
    alert: document.getElementById('crm-alert'),
    summary: document.getElementById('crm-summary'),
    today: document.getElementById('crm-today'),
    todayCount: document.getElementById('crm-today-count'),
    upcoming: document.getElementById('crm-upcoming'),
    upcomingCount: document.getElementById('crm-upcoming-count'),
    board: document.getElementById('crm-board'),
    resultCount: document.getElementById('crm-result-count'),
    search: document.getElementById('crm-search'),
    statusFilter: document.getElementById('crm-status-filter'),
    sourceFilter: document.getElementById('crm-source-filter'),
    paymentFilter: document.getElementById('crm-payment-filter'),
    refresh: document.getElementById('crm-refresh'),
    mobileTabs: document.getElementById('crm-mobile-tabs'),
    drawer: document.getElementById('crm-lead-drawer'),
    drawerBackdrop: document.getElementById('crm-drawer-backdrop'),
    drawerTitle: document.getElementById('crm-drawer-title'),
    drawerContent: document.getElementById('crm-drawer-content'),
    drawerClose: document.getElementById('crm-drawer-close'),
  };

  if (!elements.board) {
    return;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatMoney(value) {
    if (value == null) {
      return '';
    }

    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 2,
    }).format(value);
  }

  function formatDate(value, includeTime = true) {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat('en-CA', {
      dateStyle: 'medium',
      ...(includeTime ? { timeStyle: 'short' } : {}),
      timeZone: 'America/Halifax',
    }).format(date);
  }

  function sourceLabel(source) {
    const labels = {
      website_chat: 'Website chat',
      website_contact: 'Contact form',
      google_form: 'Google form',
      manual: 'Manual',
    };

    return labels[source] || String(source || 'Unknown').replaceAll('_', ' ');
  }

  function statusLabel(status) {
    return String(status || 'new')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function setAlert(message = '') {
    elements.alert.hidden = !message;
    elements.alert.textContent = message;
  }

  async function requestJson(url) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.status === 401) {
      window.location.assign('/crm/login');
      throw new Error('Authentication required.');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success !== true) {
      throw new Error(data.error || 'Unable to load CRM data.');
    }

    return data;
  }

  function renderSummary() {
    const leads = state.overview.leads;
    const booked = leads.filter((lead) => lead.status === 'booked').length;
    const open = leads.filter(
      (lead) => !['completed', 'cancelled'].includes(lead.status),
    ).length;
    const paid = leads.filter((lead) => lead.paymentStatus === 'paid').length;
    const cards = [
      ['Total leads', leads.length],
      ['Open leads', open],
      ['Booked', booked],
      ['Paid', paid],
    ];

    elements.summary.innerHTML = cards
      .map(
        ([label, value]) => `
          <article class="crm-summary-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </article>
        `,
      )
      .join('');
  }

  function appointmentMarkup(lead, emptyText) {
    const detail = lead.service || lead.vehicle || sourceLabel(lead.source);

    return `
      <button
        class="crm-appointment-card"
        type="button"
        data-lead-number="${lead.leadNumber}"
      >
        <span class="crm-appointment-time">
          ${escapeHtml(formatDate(lead.appointmentAt))}
        </span>
        <strong>#${lead.leadNumber} ${escapeHtml(lead.customer.name)}</strong>
        <small>${escapeHtml(detail || emptyText)}</small>
      </button>
    `;
  }

  function renderAppointments() {
    const { today, upcoming } = state.overview.appointments;

    elements.todayCount.textContent = String(today.length);
    elements.upcomingCount.textContent = String(upcoming.length);
    elements.today.innerHTML = today.length
      ? today.map((lead) => appointmentMarkup(lead, 'Booked today')).join('')
      : '<p class="crm-muted">No jobs booked for today.</p>';
    elements.upcoming.innerHTML = upcoming.length
      ? upcoming
          .map((lead) => appointmentMarkup(lead, 'Upcoming booking'))
          .join('')
      : '<p class="crm-muted">No upcoming booked jobs.</p>';
  }

  function populateFilters() {
    elements.statusFilter.innerHTML = [
      '<option value="">All statuses</option>',
      ...state.overview.statusGroups.map(
        (group) =>
          `<option value="${escapeHtml(group.id)}">${escapeHtml(group.label)}</option>`,
      ),
    ].join('');

    const sources = [
      ...new Set(state.overview.leads.map((lead) => lead.source).filter(Boolean)),
    ].sort();
    elements.sourceFilter.innerHTML = [
      '<option value="">All sources</option>',
      ...sources.map(
        (source) =>
          `<option value="${escapeHtml(source)}">${escapeHtml(sourceLabel(source))}</option>`,
      ),
    ].join('');
  }

  function getFilteredLeads() {
    const search = state.search.toLowerCase();

    return state.overview.leads.filter((lead) => {
      const haystack = [
        lead.leadNumber,
        lead.customer.name,
        lead.customer.phone,
        lead.customer.email,
        lead.service,
        lead.vehicle,
        lead.vehicleColor,
        lead.latestActivity,
      ]
        .join(' ')
        .toLowerCase();

      return (
        (!search || haystack.includes(search)) &&
        (!state.status || lead.statusGroup === state.status) &&
        (!state.source || lead.source === state.source) &&
        (!state.payment || lead.paymentStatus === state.payment)
      );
    });
  }

  function leadCardMarkup(lead) {
    const vehicleService = [lead.service, lead.vehicle].filter(Boolean).join(' / ');
    const booking = lead.appointmentAt
      ? formatDate(lead.appointmentAt)
      : lead.appointmentText;

    return `
      <button
        type="button"
        class="crm-lead-card"
        data-lead-number="${lead.leadNumber}"
      >
        <span class="crm-card-topline">
          <strong>#${lead.leadNumber}</strong>
          <span class="crm-payment-pill crm-payment-${escapeHtml(lead.paymentStatus)}">
            ${escapeHtml(lead.paymentStatus)}
          </span>
        </span>
        <span class="crm-card-name">${escapeHtml(lead.customer.name)}</span>
        <span class="crm-card-phone">${escapeHtml(lead.customer.phone || 'No phone')}</span>
        ${
          vehicleService
            ? `<span class="crm-card-detail">${escapeHtml(vehicleService)}</span>`
            : ''
        }
        ${
          lead.quotePrice != null
            ? `<span class="crm-card-detail">Quote: ${escapeHtml(formatMoney(lead.quotePrice))}</span>`
            : ''
        }
        ${
          booking
            ? `<span class="crm-card-booking">${escapeHtml(booking)}</span>`
            : ''
        }
        ${
          lead.latestActivity
            ? `<span class="crm-card-preview">${escapeHtml(lead.latestActivity)}</span>`
            : ''
        }
        <span class="crm-card-footer">
          <span>${escapeHtml(sourceLabel(lead.source))}</span>
          <time>${escapeHtml(formatDate(lead.createdAt, false))}</time>
        </span>
      </button>
    `;
  }

  function renderMobileTabs(groups) {
    elements.mobileTabs.innerHTML = groups
      .map(
        (group) => `
          <button type="button" data-target-column="${escapeHtml(group.id)}">
            ${escapeHtml(group.label)}
          </button>
        `,
      )
      .join('');
  }

  function renderBoard() {
    const filtered = getFilteredLeads();
    const groups = state.overview.statusGroups;
    elements.resultCount.textContent = `${filtered.length} of ${state.overview.leads.length} leads`;
    elements.board.innerHTML = groups
      .map((group) => {
        const leads = filtered.filter((lead) => lead.statusGroup === group.id);

        return `
          <section
            class="crm-board-column"
            id="crm-column-${escapeHtml(group.id)}"
            data-status-column="${escapeHtml(group.id)}"
          >
            <header>
              <h3>${escapeHtml(group.label)}</h3>
              <span>${leads.length}</span>
            </header>
            <div class="crm-column-cards">
              ${
                leads.length
                  ? leads.map(leadCardMarkup).join('')
                  : '<p class="crm-empty-column">No matching leads</p>'
              }
            </div>
          </section>
        `;
      })
      .join('');

    renderMobileTabs(groups);
  }

  function detailRow(label, value, options = {}) {
    if (value == null || value === '') {
      return '';
    }

    const renderedValue = options.html ? value : escapeHtml(value);

    return `
      <div class="crm-detail-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>${renderedValue}</dd>
      </div>
    `;
  }

  function timelineMarkup(items, emptyText) {
    if (!items.length) {
      return `<p class="crm-muted">${escapeHtml(emptyText)}</p>`;
    }

    return items
      .map(
        (item) => `
          <article class="crm-timeline-item">
            <span class="crm-timeline-dot"></span>
            <div>
              <div class="crm-timeline-meta">
                <strong>${escapeHtml(item.title)}</strong>
                <time>${escapeHtml(formatDate(item.createdAt))}</time>
              </div>
              ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ''}
              ${item.meta ? `<small>${escapeHtml(item.meta)}</small>` : ''}
            </div>
          </article>
        `,
      )
      .join('');
  }

  function renderLeadDetail(lead) {
    const phoneLink = lead.customer.phone
      ? `<a href="tel:${escapeHtml(lead.customer.phone)}">${escapeHtml(lead.customer.phone)}</a>`
      : '';
    const emailLink = lead.customer.email
      ? `<a href="mailto:${escapeHtml(lead.customer.email)}">${escapeHtml(lead.customer.email)}</a>`
      : '';
    const messageTimeline = lead.messages.map((message) => ({
      title:
        message.direction === 'inbound_website'
          ? 'Website request'
          : message.direction === 'inbound_team'
            ? 'Team command'
            : 'Team message',
      body: message.body,
      createdAt: message.created_at,
    }));
    const historyTimeline = lead.history.map((update) => ({
      title: statusLabel(update.update_type),
      body: update.message,
      meta: update.createdBy,
      createdAt: update.created_at,
    }));
    const commandTimeline = lead.commandEvents.map((event) => ({
      title: event.body,
      body: event.response_text || event.error || '',
      meta: `${event.teamMember} / ${statusLabel(event.status)}`,
      createdAt: event.created_at,
    }));

    elements.drawerTitle.innerHTML = `
      <p class="crm-eyebrow">${escapeHtml(sourceLabel(lead.source))}</p>
      <h2>#${lead.leadNumber} ${escapeHtml(lead.customer.name)}</h2>
      <span class="crm-status-pill crm-status-${escapeHtml(lead.status)}">
        ${escapeHtml(statusLabel(lead.status))}
      </span>
    `;
    elements.drawerContent.innerHTML = `
      <section class="crm-detail-section">
        <h3>Customer</h3>
        <dl class="crm-detail-list">
          ${detailRow('Phone', phoneLink, { html: true })}
          ${detailRow('Email', emailLink, { html: true })}
          ${detailRow('Source', sourceLabel(lead.source))}
          ${detailRow('Created', formatDate(lead.createdAt))}
          ${detailRow('Updated', formatDate(lead.updatedAt))}
        </dl>
      </section>

      <section class="crm-detail-section">
        <h3>Request</h3>
        <dl class="crm-detail-list">
          ${detailRow('Service', lead.service)}
          ${detailRow('Vehicle', lead.vehicle)}
          ${detailRow('Color', lead.vehicleColor)}
          ${detailRow('Preferred date', lead.preferredDate)}
          ${detailRow('Request notes', lead.requestNotes)}
        </dl>
        ${
          lead.originalRequest
            ? `<div class="crm-original-request">${escapeHtml(lead.originalRequest)}</div>`
            : '<p class="crm-muted">No original request message stored.</p>'
        }
      </section>

      <section class="crm-detail-section">
        <h3>Booking and payment</h3>
        <dl class="crm-detail-list">
          ${detailRow('Quote', lead.quotePrice == null ? '' : formatMoney(lead.quotePrice))}
          ${detailRow('Appointment', lead.appointmentAt ? formatDate(lead.appointmentAt) : lead.appointmentText)}
          ${detailRow('Appointment text', lead.appointmentText)}
          ${detailRow('Payment', statusLabel(lead.paymentStatus))}
          ${detailRow('Paid at', formatDate(lead.paidAt))}
          ${detailRow('Completed at', formatDate(lead.completedAt))}
        </dl>
      </section>

      <section class="crm-detail-section">
        <h3>Lead history</h3>
        <div class="crm-timeline">
          ${timelineMarkup(historyTimeline, 'No lead updates yet.')}
        </div>
      </section>

      <section class="crm-detail-section">
        <h3>Messages</h3>
        <div class="crm-timeline">
          ${timelineMarkup(messageTimeline, 'No messages stored.')}
        </div>
      </section>

      <details class="crm-detail-section crm-command-details">
        <summary>Internal SMS command events (${lead.commandEvents.length})</summary>
        <div class="crm-timeline">
          ${timelineMarkup(commandTimeline, 'No command events stored.')}
        </div>
      </details>
    `;
  }

  function openDrawer() {
    elements.drawer.setAttribute('aria-hidden', 'false');
    elements.drawer.classList.add('is-open');
    elements.drawerBackdrop.hidden = false;
    document.body.classList.add('crm-drawer-open');
    elements.drawerClose.focus();
  }

  function closeDrawer() {
    elements.drawer.setAttribute('aria-hidden', 'true');
    elements.drawer.classList.remove('is-open');
    elements.drawerBackdrop.hidden = true;
    document.body.classList.remove('crm-drawer-open');
  }

  async function loadLead(leadNumber) {
    elements.drawerTitle.innerHTML = `
      <p class="crm-eyebrow">Lead #${escapeHtml(leadNumber)}</p>
      <h2>Loading details...</h2>
    `;
    elements.drawerContent.innerHTML =
      '<div class="crm-detail-loading">Loading customer, messages, and history...</div>';
    openDrawer();

    try {
      const data = await requestJson(
        `/api/crm-lead?leadNumber=${encodeURIComponent(leadNumber)}`,
      );
      renderLeadDetail(data.lead);
    } catch (error) {
      elements.drawerContent.innerHTML = `
        <div class="crm-alert">${escapeHtml(error.message)}</div>
      `;
    }
  }

  async function loadOverview() {
    setAlert('');
    elements.refresh.disabled = true;
    elements.refresh.textContent = 'Refreshing...';

    try {
      state.overview = await requestJson('/api/crm-overview');
      renderSummary();
      renderAppointments();
      populateFilters();
      renderBoard();
    } catch (error) {
      setAlert(error.message);
      elements.board.innerHTML =
        '<div class="crm-board-loading">The CRM could not be loaded.</div>';
    } finally {
      elements.refresh.disabled = false;
      elements.refresh.textContent = 'Refresh';
    }
  }

  elements.search.addEventListener('input', (event) => {
    state.search = event.target.value.trim();
    renderBoard();
  });
  elements.statusFilter.addEventListener('change', (event) => {
    state.status = event.target.value;
    renderBoard();
  });
  elements.sourceFilter.addEventListener('change', (event) => {
    state.source = event.target.value;
    renderBoard();
  });
  elements.paymentFilter.addEventListener('change', (event) => {
    state.payment = event.target.value;
    renderBoard();
  });
  elements.refresh.addEventListener('click', loadOverview);
  elements.drawerClose.addEventListener('click', closeDrawer);
  elements.drawerBackdrop.addEventListener('click', closeDrawer);

  document.addEventListener('click', (event) => {
    const leadButton = event.target.closest('[data-lead-number]');

    if (leadButton) {
      loadLead(leadButton.dataset.leadNumber);
      return;
    }

    const tab = event.target.closest('[data-target-column]');

    if (tab) {
      document
        .getElementById(`crm-column-${tab.dataset.targetColumn}`)
        ?.scrollIntoView({
          behavior: 'smooth',
          inline: 'start',
          block: 'nearest',
        });
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.drawer.classList.contains('is-open')) {
      closeDrawer();
    }
  });

  loadOverview();
})();
