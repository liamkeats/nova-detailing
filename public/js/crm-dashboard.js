(() => {
  const DEFAULT_COLUMN_CARD_LIMIT = 40;

  const state = {
    overview: null,
    search: '',
    status: '',
    source: '',
    payment: '',
    showArchived: false,
    columnLimits: {},
    currentLead: null,
    actionPending: false,
    actionFeedback: null,
    editPending: false,
    editFeedback: null,
    addLeadPending: false,
    addLeadRequestId: null,
    confirmationAction: null,
    confirmationTrigger: null,
    confirmationValues: null,
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
    showArchived: document.getElementById('crm-show-archived'),
    addLeadButton: document.getElementById('crm-add-lead'),
    refresh: document.getElementById('crm-refresh'),
    mobileTabs: document.getElementById('crm-mobile-tabs'),
    drawer: document.getElementById('crm-lead-drawer'),
    drawerBackdrop: document.getElementById('crm-drawer-backdrop'),
    drawerTitle: document.getElementById('crm-drawer-title'),
    drawerContent: document.getElementById('crm-drawer-content'),
    drawerClose: document.getElementById('crm-drawer-close'),
    confirmation: document.getElementById('crm-confirmation'),
    confirmationTitle: document.getElementById('crm-confirmation-title'),
    confirmationMessage: document.getElementById('crm-confirmation-message'),
    confirmationCancel: document.getElementById('crm-confirmation-cancel'),
    confirmationSubmit: document.getElementById('crm-confirmation-submit'),
    addLeadModal: document.getElementById('crm-add-lead-modal'),
    addLeadForm: document.getElementById('crm-add-lead-form'),
    addLeadClose: document.getElementById('crm-add-lead-close'),
    addLeadCancel: document.getElementById('crm-add-lead-cancel'),
    addLeadError: document.getElementById('crm-add-lead-error'),
    addLeadSubmit: document.getElementById('crm-add-lead-submit'),
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
      in_person: 'Manual',
    };

    return labels[source] || String(source || 'Unknown').replaceAll('_', ' ');
  }

  function statusLabel(status) {
    return String(status || 'new')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function phoneDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatPhoneDisplay(value) {
    const digits = phoneDigits(value);
    const localDigits =
      digits.length === 11 && digits.startsWith('1')
        ? digits.slice(1)
        : digits;

    if (localDigits.length !== 10) {
      return String(value || '').trim();
    }

    return `(${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
  }

  function phoneHref(value) {
    const digits = phoneDigits(value);

    if (digits.length === 10) {
      return `+1${digits}`;
    }

    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    return String(value || '').trim();
  }

  function formatPhoneInput(input) {
    if (!input) {
      return;
    }

    const formatted = formatPhoneDisplay(input.value);

    if (formatted) {
      input.value = formatted;
    }
  }

  function isManualLead(lead) {
    return ['manual', 'in_person'].includes(lead?.source);
  }

  function setAlert(message = '') {
    elements.alert.hidden = !message;
    elements.alert.textContent = message;
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      window.location.assign('/crm/login');
      throw new Error('Authentication required.');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success !== true) {
      const error = new Error(data.error || 'Unable to load CRM data.');
      error.status = response.status;
      throw error;
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
    elements.statusFilter.value = state.status;

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
    elements.sourceFilter.value = state.source;
    elements.paymentFilter.value = state.payment;
  }

  function getFilteredLeads() {
    const search = state.search.toLowerCase();

    return state.overview.leads.filter((lead) => {
      const haystack = [
        lead.leadNumber,
        lead.customer.name,
        lead.customer.phone,
        phoneDigits(lead.customer.phone),
        lead.service,
        lead.vehicle,
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
        class="crm-lead-card${lead.archivedAt ? ' is-archived' : ''}"
        data-lead-number="${lead.leadNumber}"
      >
        <span class="crm-card-topline">
          <strong>#${lead.leadNumber}</strong>
          <span class="crm-card-pills">
            ${
              lead.archivedAt
                ? '<span class="crm-archived-pill">Archived</span>'
                : ''
            }
            <span class="crm-payment-pill crm-payment-${escapeHtml(lead.paymentStatus)}">
              ${escapeHtml(lead.paymentStatus)}
            </span>
          </span>
        </span>
        <span class="crm-card-name">${escapeHtml(lead.customer.name)}</span>
        <span class="crm-card-phone">${escapeHtml(formatPhoneDisplay(lead.customer.phone) || 'No phone')}</span>
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
        const limit =
          state.columnLimits[group.id] || DEFAULT_COLUMN_CARD_LIMIT;
        const visibleLeads = leads.slice(0, limit);
        const remaining = leads.length - visibleLeads.length;

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
                visibleLeads.length
                  ? visibleLeads.map(leadCardMarkup).join('')
                  : '<p class="crm-empty-column">No matching leads</p>'
              }
              ${
                remaining > 0
                  ? `
                    <button
                      type="button"
                      class="crm-column-more"
                      data-load-more-column="${escapeHtml(group.id)}"
                    >
                      Show ${Math.min(DEFAULT_COLUMN_CARD_LIMIT, remaining)} more
                      <span>${remaining} remaining</span>
                    </button>
                  `
                  : ''
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

  function formatAppointmentInput(value) {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Halifax',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function disabledAttribute(disabled) {
    return disabled ? 'disabled data-disabled' : '';
  }

  function renderManualEditSection(lead) {
    if (!isManualLead(lead) || lead.archivedAt) {
      return '';
    }

    const feedback = state.editFeedback
      ? `
        <div class="crm-action-feedback is-${escapeHtml(state.editFeedback.type)}" role="status">
          ${escapeHtml(state.editFeedback.message)}
        </div>
      `
      : '';

    return `
      <details class="crm-detail-section crm-manual-edit-section">
        <summary>
          <span>
            <span class="crm-eyebrow">Manual lead</span>
            <span class="crm-manual-edit-title">Edit typed-in details</span>
          </span>
          <span class="crm-manual-edit-cta">Edit Here</span>
        </summary>
        <p class="crm-manual-edit-helper">
          Only manual leads can be edited here.
        </p>

        ${feedback}

        <form class="crm-manual-edit-form" data-crm-manual-edit-form>
          <div class="crm-manual-edit-grid">
            <label>
              <span>Customer name</span>
              <input
                name="customerName"
                type="text"
                maxlength="120"
                value="${escapeHtml(lead.customer.name)}"
                data-crm-edit-control
                required
              />
            </label>

            <label>
              <span>Phone number</span>
              <input
                name="phone"
                type="tel"
                maxlength="40"
                inputmode="tel"
                value="${escapeHtml(formatPhoneDisplay(lead.customer.phone))}"
                data-format-phone
                data-crm-edit-control
                required
              />
            </label>
          </div>

          <label>
            <span>Email</span>
            <input
              name="email"
              type="email"
              maxlength="254"
              value="${escapeHtml(lead.customer.email)}"
              data-crm-edit-control
            />
          </label>

          <label>
            <span>Service / request details</span>
            <textarea
              name="serviceRequested"
              maxlength="500"
              rows="3"
              data-crm-edit-control
              required
            >${escapeHtml(lead.service)}</textarea>
          </label>

          <div class="crm-manual-edit-grid crm-manual-edit-vehicle-grid">
            <label>
              <span>Year</span>
              <input
                name="vehicleYear"
                type="text"
                maxlength="20"
                inputmode="numeric"
                value="${escapeHtml(lead.vehicleYear || '')}"
                data-crm-edit-control
              />
            </label>

            <label>
              <span>Make</span>
              <input
                name="vehicleMake"
                type="text"
                maxlength="80"
                value="${escapeHtml(lead.vehicleMake || '')}"
                data-crm-edit-control
              />
            </label>

            <label>
              <span>Model</span>
              <input
                name="vehicleModel"
                type="text"
                maxlength="80"
                value="${escapeHtml(lead.vehicleModel || '')}"
                data-crm-edit-control
              />
            </label>

            <label>
              <span>Color</span>
              <input
                name="vehicleColor"
                type="text"
                maxlength="80"
                value="${escapeHtml(lead.vehicleColor)}"
                data-crm-edit-control
              />
            </label>
          </div>

          <label>
            <span>Address / location</span>
            <input
              name="locationText"
              type="text"
              maxlength="220"
              value="${escapeHtml(lead.location)}"
              data-crm-edit-control
            />
          </label>

          <div class="crm-manual-edit-grid">
            <label>
              <span>Quote amount</span>
              <span class="crm-money-input">
                <span>$</span>
                <input
                  name="quotePrice"
                  type="number"
                  min="0.01"
                  max="999999.99"
                  step="0.01"
                  inputmode="decimal"
                  value="${lead.quotePrice ?? ''}"
                  data-crm-edit-control
                />
              </span>
            </label>

            <label>
              <span>Payment</span>
              <select name="paymentStatus" data-crm-edit-control>
                <option value="unpaid" ${lead.paymentStatus !== 'paid' ? 'selected' : ''}>
                  Unpaid
                </option>
                <option value="paid" ${lead.paymentStatus === 'paid' ? 'selected' : ''}>
                  Paid
                </option>
              </select>
            </label>
          </div>

          <label>
            <span>Booking date and time</span>
            <input
              name="appointmentLocal"
              type="datetime-local"
              value="${escapeHtml(formatAppointmentInput(lead.appointmentAt))}"
              data-crm-edit-control
            />
          </label>

          <p class="crm-action-note">
            Status changes and internal notes still use the normal action buttons below.
            Saving this form records an edit history entry.
          </p>

          <div class="crm-manual-edit-actions">
            <button type="submit" data-crm-edit-control>
              Save manual edits
            </button>
          </div>
        </form>
      </details>
    `;
  }

  function renderActionSection(lead) {
    const isArchived = Boolean(lead.archivedAt);
    const isCompleted = lead.status === 'completed';
    const isCompletedPaid =
      isCompleted && lead.paymentStatus === 'paid';
    const isCompletedUnpaid =
      isCompleted && lead.paymentStatus !== 'paid';
    const isCancelled = lead.status === 'cancelled';
    const isEditingLocked = isCompleted || isCancelled;
    const canChangeStatus = !isCancelled;
    const canMarkPaid =
      !isCancelled && lead.paymentStatus !== 'paid';
    const canMarkUnpaid =
      !isCancelled && lead.paymentStatus === 'paid';
    const statusOptions = [
      ['new', 'New'],
      ['contacted', 'Contacted'],
      ['waiting', 'Waiting'],
      ['quoted', 'Quoted'],
      ['booked', 'Booked'],
    ];
    const feedback = state.actionFeedback
      ? `
        <div class="crm-action-feedback is-${escapeHtml(state.actionFeedback.type)}" role="status">
          ${escapeHtml(state.actionFeedback.message)}
        </div>
      `
      : '';

    if (isArchived) {
      return `
        <section class="crm-detail-section crm-actions-section">
          <div class="crm-actions-heading">
            <div>
              <p class="crm-eyebrow">Archived lead</p>
              <h3>Restore this lead</h3>
            </div>
            <span>All history has been preserved</span>
          </div>

          ${feedback}

          <p class="crm-action-note">
            This lead is hidden from the normal CRM board and search.
            Restoring it returns it to its previous workflow column.
          </p>

          <button
            type="button"
            class="crm-restore-button"
            data-crm-quick-action="restore"
            data-crm-action-control
          >
            Restore to board
          </button>
        </section>
      `;
    }

    return `
      <section class="crm-detail-section crm-actions-section">
        <div class="crm-actions-heading">
          <div>
            <p class="crm-eyebrow">Team actions</p>
            <h3>Update this lead</h3>
          </div>
          <span>Saved changes appear in history</span>
        </div>

        ${feedback}

        <div class="crm-action-grid">
          <form class="crm-action-form" data-crm-action-form="status">
            <label>
              <span>Lead status</span>
              <select
                name="status"
                data-crm-action-control
                ${disabledAttribute(!canChangeStatus)}
                required
              >
                <option value="">Choose status</option>
                ${statusOptions
                  .map(
                    ([value, label]) => `
                      <option
                        value="${value}"
                        ${lead.status === value ? 'selected' : ''}
                      >
                        ${label}
                      </option>
                    `,
                  )
                  .join('')}
              </select>
            </label>
            <button
              type="submit"
              data-crm-action-control
              ${disabledAttribute(!canChangeStatus)}
            >
              ${isCompleted ? 'Reopen lead' : 'Save status'}
            </button>
          </form>

          <form class="crm-action-form" data-crm-action-form="quote">
            <label>
              <span>Quote price</span>
              <span class="crm-money-input">
                <span>$</span>
                <input
                  type="number"
                  name="amount"
                  min="0.01"
                  max="999999.99"
                  step="0.01"
                  value="${lead.quotePrice ?? ''}"
                  inputmode="decimal"
                  data-crm-action-control
                  ${disabledAttribute(isEditingLocked)}
                  required
                />
              </span>
            </label>
            <button
              type="submit"
              data-crm-action-control
              ${disabledAttribute(isEditingLocked)}
            >
              Save quote
            </button>
          </form>
        </div>

        <form class="crm-action-form crm-book-form" data-crm-action-form="book">
          <label>
            <span>Appointment date and time</span>
            <input
              type="datetime-local"
              name="appointmentLocal"
              value="${escapeHtml(formatAppointmentInput(lead.appointmentAt))}"
              data-crm-action-control
              ${disabledAttribute(isEditingLocked)}
              required
            />
          </label>
          <button
            type="submit"
            data-crm-action-control
            ${disabledAttribute(isEditingLocked)}
          >
            Book appointment
          </button>
        </form>

        <form class="crm-action-form crm-note-form" data-crm-action-form="note">
          <label>
            <span>Add internal note</span>
            <textarea
              name="note"
              maxlength="2000"
              rows="3"
              placeholder="Add a note for Liam and Elijah..."
              data-crm-action-control
              required
            ></textarea>
          </label>
          <button type="submit" data-crm-action-control>Add note</button>
        </form>

        <div class="crm-quick-actions" aria-label="Lead quick actions">
          <button
            type="button"
            data-crm-quick-action="no_reply"
            data-crm-action-control
            ${disabledAttribute(isEditingLocked || lead.status === 'no_reply')}
          >
            No reply
          </button>
          <button
            type="button"
            data-crm-quick-action="paid"
            data-crm-action-control
            ${disabledAttribute(!canMarkPaid)}
          >
            Mark paid
          </button>
          <button
            type="button"
            data-crm-quick-action="unpaid"
            data-crm-action-control
            ${disabledAttribute(!canMarkUnpaid)}
          >
            Mark unpaid
          </button>
          <button
            type="button"
            data-crm-quick-action="done"
            data-crm-action-control
            ${disabledAttribute(isEditingLocked)}
          >
            Mark done
          </button>
          <button
            type="button"
            class="is-danger"
            data-crm-quick-action="cancel"
            data-crm-action-control
            ${disabledAttribute(isEditingLocked)}
          >
            Cancel lead
          </button>
          <button
            type="button"
            class="is-danger"
            data-crm-quick-action="archive"
            data-crm-action-control
          >
            Remove from board
          </button>
        </div>

        ${
          isCancelled
            ? '<p class="crm-action-note">Cancelled leads can receive internal notes or be removed from the board.</p>'
            : isCompletedUnpaid
              ? '<p class="crm-action-note">This job is completed but unpaid. You can add notes, mark it paid, or reopen it to an active status.</p>'
              : isCompletedPaid
                ? '<p class="crm-action-note">This job is completed and paid. You can add notes, mark it unpaid, or reopen it. Reopening also resets payment to unpaid.</p>'
              : ''
        }
      </section>
    `;
  }

  function renderLeadDetail(lead) {
    state.currentLead = lead;
    const displayPhone = formatPhoneDisplay(lead.customer.phone);
    const phoneLink = displayPhone
      ? `<a href="tel:${escapeHtml(phoneHref(displayPhone))}">${escapeHtml(displayPhone)}</a>`
      : '';
    const emailLink = lead.customer.email
      ? `<a href="mailto:${escapeHtml(lead.customer.email)}">${escapeHtml(lead.customer.email)}</a>`
      : '';
    const messageTimeline = lead.messages.map((message) => {
      const isManualCreate =
        message.direction === 'inbound_team' &&
        /^Manual lead created by /i.test(message.body || '');

      return {
        title:
          message.direction === 'inbound_website'
            ? 'Website request'
            : isManualCreate
              ? 'Manual lead created'
              : message.direction === 'inbound_team'
                ? 'Team update'
                : 'Team message',
        body: message.body,
        createdAt: message.created_at,
      };
    });
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
      <span class="crm-lead-state-pills">
        <span class="crm-status-pill crm-status-${escapeHtml(lead.status)}">
          ${escapeHtml(statusLabel(lead.status))}
        </span>
        <span class="crm-payment-pill crm-payment-${escapeHtml(lead.paymentStatus)}">
          ${escapeHtml(statusLabel(lead.paymentStatus))}
        </span>
        ${
          lead.archivedAt
            ? '<span class="crm-archived-pill">Archived</span>'
            : ''
        }
      </span>
    `;
    elements.drawerContent.innerHTML = `
      ${renderManualEditSection(lead)}
      ${renderActionSection(lead)}

      <section class="crm-detail-section">
        <h3>Customer</h3>
        <dl class="crm-detail-list">
          ${detailRow('Phone', phoneLink, { html: true })}
          ${detailRow('Email', emailLink, { html: true })}
          ${detailRow('Source', sourceLabel(lead.source))}
          ${detailRow('Created', formatDate(lead.createdAt))}
          ${detailRow('Updated', formatDate(lead.updatedAt))}
          ${detailRow('Archived at', formatDate(lead.archivedAt))}
          ${detailRow('Archived by', lead.archivedBy)}
        </dl>
      </section>

      <section class="crm-detail-section">
        <h3>Request</h3>
        <dl class="crm-detail-list">
          ${detailRow('Service', lead.service)}
          ${detailRow('Vehicle', lead.vehicle)}
          ${detailRow('Color', lead.vehicleColor)}
          ${detailRow('Location', lead.location)}
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
    closeConfirmation();
    elements.drawer.setAttribute('aria-hidden', 'true');
    elements.drawer.classList.remove('is-open');
    elements.drawerBackdrop.hidden = true;
    document.body.classList.remove('crm-drawer-open');
    state.currentLead = null;
    state.actionFeedback = null;
    state.editFeedback = null;
  }

  function setAddLeadError(message = '') {
    if (!elements.addLeadError) {
      return;
    }

    elements.addLeadError.hidden = !message;
    elements.addLeadError.textContent = message;
  }

  function setAddLeadPending(pending) {
    state.addLeadPending = pending;

    if (elements.addLeadSubmit) {
      elements.addLeadSubmit.disabled = pending;
      elements.addLeadSubmit.textContent = pending
        ? 'Creating...'
        : 'Create lead';
    }

    elements.addLeadForm
      ?.querySelectorAll('input, select, textarea, button')
      .forEach((control) => {
        control.disabled = pending;
      });
  }

  function openAddLeadModal() {
    if (!elements.addLeadModal || state.addLeadPending) {
      return;
    }

    state.addLeadRequestId = null;
    elements.addLeadForm?.reset();
    setAddLeadError('');
    elements.addLeadModal.hidden = false;
    document.body.classList.add('crm-modal-open');
    elements.addLeadForm?.elements.customerName?.focus();
  }

  function closeAddLeadModal() {
    if (!elements.addLeadModal || elements.addLeadModal.hidden) {
      return;
    }

    elements.addLeadModal.hidden = true;
    document.body.classList.remove('crm-modal-open');
    state.addLeadRequestId = null;
    setAddLeadError('');
    elements.addLeadButton?.focus();
  }

  function getAddLeadPayload(form) {
    formatPhoneInput(form.elements.phone);
    const formData = new FormData(form);

    if (!state.addLeadRequestId) {
      state.addLeadRequestId = crypto.randomUUID();
    }

    return {
      requestId: state.addLeadRequestId,
      customerName: formData.get('customerName'),
      phone: formData.get('phone'),
      serviceRequested: formData.get('serviceRequested'),
      status: formData.get('status'),
      vehicleYear: formData.get('vehicleYear'),
      vehicleMake: formData.get('vehicleMake'),
      vehicleModel: formData.get('vehicleModel'),
      vehicleColor: formData.get('vehicleColor'),
      locationText: formData.get('locationText'),
      preferredDate: formData.get('preferredDate'),
      quotePrice: formData.get('quotePrice'),
      appointmentLocal: formData.get('appointmentLocal'),
      paymentStatus: formData.get('paymentStatus'),
      internalNote: formData.get('internalNote'),
    };
  }

  async function submitManualLead(form) {
    if (state.addLeadPending) {
      return;
    }

    const payload = getAddLeadPayload(form);

    setAddLeadPending(true);
    setAddLeadError('');
    setAlert('');

    try {
      const data = await requestJson('/api/crm-manual-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const notificationStatus = data.notification?.status;
      const notificationMessage =
        notificationStatus && !['sent', 'skipped'].includes(notificationStatus)
          ? ` ${data.notification.message || 'SMS notification needs attention.'}`
          : '';

      closeAddLeadModal();
      await loadOverview({ silent: true });
      renderLeadDetail(data.lead);
      openDrawer();
      setAlert(`${data.result.responseText}${notificationMessage}`);
      state.addLeadRequestId = null;
    } catch (error) {
      setAddLeadError(error.message);
    } finally {
      setAddLeadPending(false);
    }
  }

  function setManualEditPending(pending) {
    state.editPending = pending;
    elements.drawer.classList.toggle('is-saving', pending);
    elements.drawer
      .querySelectorAll('[data-crm-edit-control]')
      .forEach((control) => {
        control.disabled = pending;
      });
  }

  function getManualEditPayload(form) {
    formatPhoneInput(form.elements.phone);
    const formData = new FormData(form);

    return {
      leadNumber: state.currentLead?.leadNumber,
      requestId: crypto.randomUUID(),
      expectedUpdatedAt: state.currentLead?.updatedAt,
      customerName: formData.get('customerName'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      serviceRequested: formData.get('serviceRequested'),
      vehicleYear: formData.get('vehicleYear'),
      vehicleMake: formData.get('vehicleMake'),
      vehicleModel: formData.get('vehicleModel'),
      vehicleColor: formData.get('vehicleColor'),
      locationText: formData.get('locationText'),
      quotePrice: formData.get('quotePrice'),
      appointmentLocal: formData.get('appointmentLocal'),
      paymentStatus: formData.get('paymentStatus'),
    };
  }

  async function submitManualEdit(form) {
    if (!state.currentLead || state.editPending) {
      return;
    }

    const payload = getManualEditPayload(form);

    setManualEditPending(true);
    state.editFeedback = null;
    setAlert('');

    try {
      const data = await requestJson('/api/crm-manual-lead-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      state.editFeedback = {
        type: 'success',
        message: data.result.responseText,
      };
      await loadOverview({ silent: true });
      renderLeadDetail(data.lead);
    } catch (error) {
      state.editFeedback = {
        type: 'error',
        message: error.message,
      };

      if (error.status === 409) {
        try {
          const refreshed = await requestJson(
            `/api/crm-lead?leadNumber=${encodeURIComponent(payload.leadNumber)}${
              state.showArchived ? '&includeArchived=true' : ''
            }`,
          );
          state.currentLead = refreshed.lead;
          await loadOverview({ silent: true });
        } catch {
          // Keep the original edit conflict message visible.
        }
      }

      if (state.currentLead) {
        renderLeadDetail(state.currentLead);
      }
    } finally {
      setManualEditPending(false);
    }
  }

  const confirmationCopy = {
    no_reply: {
      title: 'Mark this lead as no reply?',
      message: 'The lead will move to No Reply. You can still reopen it later by changing its status.',
      button: 'Mark no reply',
    },
    paid: {
      title: 'Mark this job as paid?',
      message: 'Payment will be recorded and the job will move to Completed - Paid if it is not already completed.',
      button: 'Mark paid',
    },
    unpaid: {
      title: 'Mark this job as unpaid?',
      message: 'Payment will reset to unpaid and the paid timestamp will be cleared. The job will remain completed.',
      button: 'Mark unpaid',
    },
    done: {
      title: 'Mark this job as done?',
      message: 'The job will move to Completed - Unpaid. Payment will remain unchanged until you use Mark paid.',
      button: 'Mark done',
    },
    cancel: {
      title: 'Cancel this lead?',
      message: 'The lead will move to Cancelled and will be removed from the open pipeline.',
      button: 'Cancel lead',
      danger: true,
    },
    archive: {
      title: 'Remove this lead from the board?',
      message: 'The lead will be archived and hidden from the normal CRM board and search. Customer details, messages, notes, history, commands, and intake records will be kept.',
      button: 'Remove from board',
      danger: true,
    },
    restore: {
      title: 'Restore this lead to the board?',
      message: 'The archive fields will be cleared and the lead will return to its previous workflow column. The archive and restore history will remain.',
      button: 'Restore to board',
    },
  };

  function openConfirmation(action, trigger, values = {}, copyOverride) {
    const copy = copyOverride || confirmationCopy[action];

    if (!copy || state.actionPending) {
      return;
    }

    state.confirmationAction = action;
    state.confirmationTrigger = trigger;
    state.confirmationValues = values;
    elements.confirmationTitle.textContent = copy.title;
    elements.confirmationMessage.textContent = copy.message;
    elements.confirmationSubmit.textContent = copy.button;
    elements.confirmationSubmit.classList.toggle('is-danger', copy.danger);
    elements.confirmation.hidden = false;
    document.body.classList.add('crm-confirmation-open');
    elements.confirmationSubmit.focus();
  }

  function closeConfirmation({ restoreFocus = true } = {}) {
    if (!elements.confirmation || elements.confirmation.hidden) {
      return;
    }

    elements.confirmation.hidden = true;
    document.body.classList.remove('crm-confirmation-open');

    if (restoreFocus) {
      state.confirmationTrigger?.focus();
    }

    state.confirmationAction = null;
    state.confirmationTrigger = null;
    state.confirmationValues = null;
  }

  async function loadLead(leadNumber) {
    state.actionFeedback = null;
    state.editFeedback = null;
    elements.drawerTitle.innerHTML = `
      <p class="crm-eyebrow">Lead #${escapeHtml(leadNumber)}</p>
      <h2>Loading details...</h2>
    `;
    elements.drawerContent.innerHTML =
      '<div class="crm-detail-loading">Loading customer, messages, and history...</div>';
    openDrawer();

    try {
      const data = await requestJson(
        `/api/crm-lead?leadNumber=${encodeURIComponent(leadNumber)}${
          state.showArchived ? '&includeArchived=true' : ''
        }`,
      );
      renderLeadDetail(data.lead);
    } catch (error) {
      elements.drawerContent.innerHTML = `
        <div class="crm-alert">${escapeHtml(error.message)}</div>
      `;
    }
  }

  async function loadOverview({ silent = false } = {}) {
    if (!silent) {
      setAlert('');
      elements.refresh.disabled = true;
      elements.refresh.textContent = 'Refreshing...';
    }

    try {
      state.overview = await requestJson(
        `/api/crm-overview${
          state.showArchived ? '?includeArchived=true' : ''
        }`,
      );
      renderSummary();
      renderAppointments();
      populateFilters();
      renderBoard();
    } catch (error) {
      setAlert(error.message);
      if (!silent) {
        elements.board.innerHTML =
          '<div class="crm-board-loading">The CRM could not be loaded.</div>';
      }
    } finally {
      if (!silent) {
        elements.refresh.disabled = false;
        elements.refresh.textContent = 'Refresh';
      }
    }
  }

  function setActionPending(pending) {
    state.actionPending = pending;
    elements.drawer.classList.toggle('is-saving', pending);
    elements.drawer
      .querySelectorAll('[data-crm-action-control]')
      .forEach((control) => {
        control.disabled = pending || control.hasAttribute('data-disabled');
      });
  }

  async function submitCrmAction(action, values = {}) {
    if (!state.currentLead || state.actionPending) {
      return;
    }

    const leadNumber = state.currentLead.leadNumber;
    setActionPending(true);
    setAlert('');

    try {
      const data = await requestJson('/api/crm-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadNumber,
          action,
          requestId: crypto.randomUUID(),
          expectedUpdatedAt: state.currentLead.updatedAt,
          ...values,
        }),
      });

      state.actionFeedback = {
        type: 'success',
        message: data.result.responseText,
      };
      await loadOverview({ silent: true });

      if (action === 'archive') {
        closeDrawer();
        setAlert(data.result.responseText);
        return;
      }

      renderLeadDetail(data.lead);
    } catch (error) {
      state.actionFeedback = {
        type: 'error',
        message: error.message,
      };

      if (error.status === 409) {
        try {
          const refreshed = await requestJson(
            `/api/crm-lead?leadNumber=${encodeURIComponent(leadNumber)}${
              state.showArchived ? '&includeArchived=true' : ''
            }`,
          );
          state.currentLead = refreshed.lead;
          await loadOverview({ silent: true });
        } catch {
          // Keep the original conflict message visible.
        }
      }

      if (state.currentLead) {
        renderLeadDetail(state.currentLead);
      }
    } finally {
      setActionPending(false);
    }
  }

  function handleActionForm(form) {
    const action = form.dataset.crmActionForm;
    const formData = new FormData(form);
    const values = {};

    if (action === 'status') {
      values.status = formData.get('status');
    } else if (action === 'quote') {
      values.amount = formData.get('amount');
    } else if (action === 'book') {
      values.appointmentLocal = formData.get('appointmentLocal');
    } else if (action === 'note') {
      values.note = formData.get('note');
    }

    if (action === 'status' && state.currentLead?.status === 'completed') {
      const targetStatus = String(values.status || '');
      const targetLabel =
        targetStatus === 'waiting'
          ? 'Contacted / Waiting'
          : targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1);
      const resetsPayment =
        state.currentLead.paymentStatus === 'paid';

      openConfirmation(
        action,
        form.querySelector('button[type="submit"]'),
        values,
        {
          title: `Reopen this lead as ${targetLabel}?`,
          message: resetsPayment
            ? 'The lead will return to the active pipeline. Because paid implies completed, reopening will also mark it unpaid and clear the paid timestamp.'
            : 'The lead will return to the active pipeline and its completion timestamp will be cleared.',
          button: 'Reopen lead',
        },
      );
      return;
    }

    submitCrmAction(action, values);
  }

  elements.search.addEventListener('input', (event) => {
    state.search = event.target.value.trim();
    state.columnLimits = {};
    renderBoard();
  });
  elements.statusFilter.addEventListener('change', (event) => {
    state.status = event.target.value;
    state.columnLimits = {};
    renderBoard();
  });
  elements.sourceFilter.addEventListener('change', (event) => {
    state.source = event.target.value;
    state.columnLimits = {};
    renderBoard();
  });
  elements.paymentFilter.addEventListener('change', (event) => {
    state.payment = event.target.value;
    state.columnLimits = {};
    renderBoard();
  });
  elements.showArchived.addEventListener('change', (event) => {
    state.showArchived = event.target.checked;
    state.columnLimits = {};

    if (!state.showArchived && state.currentLead?.archivedAt) {
      closeDrawer();
    }

    loadOverview();
  });
  elements.addLeadButton?.addEventListener('click', openAddLeadModal);
  elements.addLeadClose?.addEventListener('click', closeAddLeadModal);
  elements.addLeadCancel?.addEventListener('click', closeAddLeadModal);
  elements.addLeadModal?.addEventListener('click', (event) => {
    if (event.target === elements.addLeadModal && !state.addLeadPending) {
      closeAddLeadModal();
    }
  });
  elements.addLeadForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitManualLead(elements.addLeadForm);
  });
  elements.refresh.addEventListener('click', loadOverview);
  elements.drawerClose.addEventListener('click', closeDrawer);
  elements.drawerBackdrop.addEventListener('click', closeDrawer);
  elements.confirmationCancel.addEventListener('click', closeConfirmation);
  elements.confirmation.addEventListener('click', (event) => {
    if (event.target === elements.confirmation) {
      closeConfirmation();
    }
  });
  elements.confirmationSubmit.addEventListener('click', () => {
    const action = state.confirmationAction;
    const values = state.confirmationValues || {};
    closeConfirmation({ restoreFocus: false });

    if (action) {
      submitCrmAction(action, values);
    }
  });

  document.addEventListener('submit', (event) => {
    const editForm = event.target.closest('[data-crm-manual-edit-form]');

    if (editForm) {
      event.preventDefault();
      submitManualEdit(editForm);
      return;
    }

    const form = event.target.closest('[data-crm-action-form]');

    if (!form) {
      return;
    }

    event.preventDefault();
    handleActionForm(form);
  });

  document.addEventListener(
    'blur',
    (event) => {
      const input = event.target.closest('[data-format-phone]');

      if (input) {
        formatPhoneInput(input);
      }
    },
    true,
  );

  document.addEventListener('click', (event) => {
    const loadMore = event.target.closest('[data-load-more-column]');

    if (loadMore) {
      const groupId = loadMore.dataset.loadMoreColumn;
      state.columnLimits[groupId] =
        (state.columnLimits[groupId] || DEFAULT_COLUMN_CARD_LIMIT) +
        DEFAULT_COLUMN_CARD_LIMIT;
      renderBoard();
      return;
    }

    const quickAction = event.target.closest('[data-crm-quick-action]');

    if (quickAction) {
      const action = quickAction.dataset.crmQuickAction;
      openConfirmation(action, quickAction);
      return;
    }

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
    if (
      event.key === 'Escape' &&
      elements.addLeadModal &&
      !elements.addLeadModal.hidden &&
      !state.addLeadPending
    ) {
      closeAddLeadModal();
    } else if (event.key === 'Escape' && !elements.confirmation.hidden) {
      closeConfirmation();
    } else if (
      event.key === 'Escape' &&
      elements.drawer.classList.contains('is-open')
    ) {
      closeDrawer();
    }
  });

  loadOverview();
})();
