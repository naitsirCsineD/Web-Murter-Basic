(function () {
  const parcelas = window.PARCELAS || {};
  const allEntries = Object.values(parcelas);
  let activeGroup = '';
  let highlightedKey = '';

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function parcelKey(item) {
    return `${item.zkul}|${item.parcela}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function getEffectiveLinks() {
    return window.MurterStorage ? window.MurterStorage.getEffectiveLinks() : {};
  }

  function getLinksForParcel(item) {
    return getEffectiveLinks()[parcelKey(item)] || { catastro: '', kmz: '' };
  }

  function getStatusForLinks(links) {
    const hasCatastro = Boolean(normalize(links.catastro));
    const hasKmz = Boolean(normalize(links.kmz));
    if (hasCatastro && hasKmz) return 'completa';
    if (hasCatastro || hasKmz) return 'parcial';
    return 'pendiente';
  }

  function getGroups() {
    const groups = {};
    allEntries.forEach(function (item) {
      const groupName = item.grupo || 'SIN GRUPO';
      if (!groups[groupName]) {
        groups[groupName] = {
          grupo: groupName,
          zkul: item.zkul || '',
          registros: [],
          totalParcels: 0,
          conLink: 0,
          conKmz: 0,
          completas: 0,
          parciales: 0,
          pendientes: 0
        };
      }
      groups[groupName].registros.push(item);
    });

    Object.keys(groups).forEach(function (groupName) {
      const summary = groups[groupName];
      summary.totalParcels = summary.registros.length;
      summary.conLink = 0;
      summary.conKmz = 0;
      summary.completas = 0;
      summary.parciales = 0;
      summary.pendientes = 0;

      summary.registros.forEach(function (item) {
        const links = getLinksForParcel(item);
        if (normalize(links.catastro)) summary.conLink += 1;
        if (normalize(links.kmz)) summary.conKmz += 1;
        const status = getStatusForLinks(links);
        if (status === 'completa') summary.completas += 1;
        if (status === 'parcial') summary.parciales += 1;
        if (status === 'pendiente') summary.pendientes += 1;
      });
    });

    return groups;
  }

  function renderSummary(groups) {
    const links = getEffectiveLinks();
    const knownKeys = new Set(allEntries.map(parcelKey));
    const totalOfficialLinks = Object.keys(links).filter(function (key) {
      return knownKeys.has(key) && normalize(links[key].catastro);
    }).length;
    const totalKmz = Object.keys(links).filter(function (key) {
      return knownKeys.has(key) && normalize(links[key].kmz);
    }).length;

    document.getElementById('summaryRegisters').textContent = String(Object.keys(groups).length);
    document.getElementById('summaryParcels').textContent = String(allEntries.length);
    document.getElementById('summaryLinks').textContent = String(totalOfficialLinks);
    document.getElementById('summaryKmz').textContent = String(totalKmz);
  }

  function buildCard(groupName, summary) {
    const card = document.createElement('article');
    card.className = 'property-card';
    card.dataset.group = groupName;
    card.dataset.zkul = summary.zkul;
    card.dataset.status = summary.pendientes === 0 ? 'completa' : (summary.conLink || summary.conKmz ? 'parcial' : 'pendiente');

    card.innerHTML = `
      <div class="card-header">
        <span class="group-badge">${escapeHtml(groupName)}</span>
        <span class="status-dot status-${card.dataset.status}">${escapeHtml(card.dataset.status.toUpperCase())}</span>
      </div>
      <div class="card-body">
        <div class="record-title">ZK. UL. ${escapeHtml(summary.zkul)}</div>
        <div class="municipality">Murter Betina</div>
        <div class="stat-line">
          <span>${summary.totalParcels} parcelas</span>
          <span>${summary.conLink} enlaces oficiales</span>
          <span>${summary.conKmz} KMZ disponibles</span>
        </div>
        <div class="pending-box">${summary.pendientes} enlaces pendientes</div>
      </div>
      <div class="card-footer">
        <button type="button" class="primary-button open-group" data-group="${escapeAttr(groupName)}">VER PARCELAS</button>
      </div>
    `;

    return card;
  }

  function populateZkulFilter(groups) {
    const select = document.getElementById('filtroZkul');
    if (!select || select.dataset.ready === 'true') return;
    Object.keys(groups)
      .map(function (groupName) { return groups[groupName].zkul; })
      .filter(Boolean)
      .sort(function (a, b) { return Number(a) - Number(b); })
      .forEach(function (zkul) {
        const option = document.createElement('option');
        option.value = zkul;
        option.textContent = zkul;
        select.appendChild(option);
      });
    select.dataset.ready = 'true';
  }

  function rowMatchesFilter(item) {
    const query = normalize(document.getElementById('searchInput')?.value || '').toLowerCase();
    const zkul = document.getElementById('filtroZkul')?.value || 'todos';
    const estado = document.getElementById('filtroEstado')?.value || 'todos';
    const links = getLinksForParcel(item);
    const status = getStatusForLinks(links);
    const haystack = `${item.zkul} ${item.parcela} ${item.designacion} ${parcelKey(item)}`.toLowerCase();

    return (!query || haystack.includes(query)) &&
      (zkul === 'todos' || item.zkul === zkul) &&
      (estado === 'todos' || status === estado);
  }

  function renderMosaic() {
    const groups = getGroups();
    const container = document.getElementById('propertyGrid');
    if (!container) return;
    populateZkulFilter(groups);

    container.innerHTML = '';
    Object.keys(groups)
      .sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); })
      .forEach(function (groupName) {
        const summary = groups[groupName];
        const hasVisibleRows = summary.registros.some(rowMatchesFilter);
        if (!hasVisibleRows) return;
        container.appendChild(buildCard(groupName, summary));
      });

    container.querySelectorAll('.open-group').forEach(function (button) {
      button.addEventListener('click', function () {
        openGroup(button.dataset.group);
      });
    });

    renderSummary(groups);
    highlightActiveCard();
  }

  function linkButton(label, disabledLabel, url, kind) {
    const safeUrl = escapeAttr(url);
    if (!normalize(url)) {
      return `<button type="button" class="action-chip is-disabled" disabled>${disabledLabel}</button>`;
    }
    const successClass = kind === 'kmz' ? ' is-success' : '';
    return `<button type="button" class="action-chip${successClass}" data-kind="${kind}" data-url="${safeUrl}">${label}</button>`;
  }

  function copyButton(label, url) {
    if (!normalize(url)) return '';
    return `<button type="button" class="mini-button copy-link" data-url="${escapeAttr(url)}">${label}</button>`;
  }

  function renderRows(entries) {
    const visibleRows = entries.filter(rowMatchesFilter);
    if (!visibleRows.length) {
      return '<tr><td colspan="5" class="empty-row">No hay parcelas para los filtros activos.</td></tr>';
    }

    return visibleRows.map(function (item) {
      const links = getLinksForParcel(item);
      const key = parcelKey(item);
      const isHighlighted = highlightedKey === key ? ' class="row-highlight"' : '';
      return `
        <tr data-key="${escapeAttr(key)}" data-parcela="${escapeAttr(item.parcela)}"${isHighlighted}>
          <td><button type="button" class="parcel-name trigger-detail" data-key="${escapeAttr(key)}">${escapeHtml(item.parcela)}</button></td>
          <td>${escapeHtml(item.designacion)}</td>
          <td>${escapeHtml(item.superficie || '—')}</td>
          <td>
            ${linkButton('VER PARCELA', 'SIN LINK', links.catastro, 'catastro')}
            ${copyButton('COPIAR LINK', links.catastro)}
          </td>
          <td>
            ${linkButton('DESCARGAR KMZ', 'SIN KMZ', links.kmz, 'kmz')}
            ${copyButton('COPIAR KMZ', links.kmz)}
          </td>
        </tr>
      `;
    }).join('');
  }

  function openGroup(groupName, parcelToHighlight) {
    const groups = getGroups();
    const summary = groups[groupName];
    const detail = document.getElementById('detailPanel');
    if (!summary || !detail) return;

    activeGroup = groupName;
    highlightedKey = parcelToHighlight ? parcelKey(parcelToHighlight) : highlightedKey;

    detail.innerHTML = `
      <div class="detail-header">
        <div>
          <div class="detail-group-label">${escapeHtml(groupName)}</div>
          <h2>Registro ZK. UL. ${escapeHtml(summary.zkul)}</h2>
          <p>${summary.totalParcels} parcelas · ${summary.conLink} enlaces oficiales · ${summary.conKmz} KMZ disponibles</p>
        </div>
        <button type="button" class="secondary-button close-detail">CERRAR</button>
      </div>
      <div class="table-wrap">
        <table class="parcel-table">
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Designación</th>
              <th>Superficie</th>
              <th>Catastro</th>
              <th>KMZ</th>
            </tr>
          </thead>
          <tbody>${renderRows(summary.registros)}</tbody>
        </table>
      </div>
    `;

    detail.classList.add('open');
    bindDetailActions(detail);
    highlightActiveCard();

    if (parcelToHighlight) {
      window.location.hash = `parcela=${encodeURIComponent(parcelToHighlight.parcela)}`;
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const row = Array.from(detail.querySelectorAll('tr[data-key]')).find(function (entry) {
        return entry.dataset.key === parcelKey(parcelToHighlight);
      });
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function bindDetailActions(scope) {
    scope.querySelector('.close-detail')?.addEventListener('click', function () {
      activeGroup = '';
      highlightedKey = '';
      scope.classList.remove('open');
      scope.innerHTML = '';
      highlightActiveCard();
    });

    scope.querySelectorAll('.action-chip[data-url]').forEach(function (button) {
      button.addEventListener('click', function () {
        const url = button.dataset.url || '';
        if (!url) return;
        if (button.dataset.kind === 'kmz') {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.download = url.split('/').pop() || 'parcela.kmz';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    });

    scope.querySelectorAll('.copy-link').forEach(function (button) {
      button.addEventListener('click', function () {
        copyText(button.dataset.url || '', 'Copiar enlace');
      });
    });

    scope.querySelectorAll('.trigger-detail').forEach(function (button) {
      button.addEventListener('click', function () {
        const item = parcelas[button.dataset.key];
        if (item) openParcelModal(item);
      });
    });
  }

  function copyText(value, label) {
    if (!value) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).catch(function () {
        window.prompt(label, value);
      });
      return;
    }
    window.prompt(label, value);
  }

  function openParcelModal(parcel) {
    const links = getLinksForParcel(parcel);
    const modal = document.getElementById('parcelModal');
    if (!modal) return;

    document.getElementById('modalTitle').textContent = `${parcel.parcela} · ${parcel.designacion}`;
    document.getElementById('modalZkul').textContent = parcel.zkul;
    document.getElementById('modalParcela').textContent = parcel.parcela;
    document.getElementById('modalDesignacion').textContent = parcel.designacion;
    document.getElementById('modalSuperficie').textContent = parcel.superficie || '—';
    document.getElementById('modalCatastro').innerHTML = normalize(links.catastro)
      ? `<a href="${escapeAttr(links.catastro)}" target="_blank" rel="noopener noreferrer">${escapeHtml(links.catastro)}</a>`
      : 'Sin enlace asignado';
    document.getElementById('modalKmz').innerHTML = normalize(links.kmz)
      ? `<a href="${escapeAttr(links.kmz)}" target="_blank" rel="noopener noreferrer">${escapeHtml(links.kmz)}</a>`
      : 'Sin KMZ asignado';

    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeParcelModal() {
    const modal = document.getElementById('parcelModal');
    if (!modal) return;
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
  }

  function findParcelByQuery(query) {
    const normalized = normalize(query).toLowerCase();
    if (!normalized) return null;
    return allEntries.find(function (parcel) {
      const key = parcelKey(parcel);
      return `${parcel.parcela} ${parcel.designacion} ${parcel.zkul} ${key}`.toLowerCase().includes(normalized);
    }) || null;
  }

  function highlightActiveCard() {
    document.querySelectorAll('.property-card').forEach(function (card) {
      card.classList.toggle('is-highlighted', Boolean(activeGroup) && card.dataset.group === activeGroup);
    });
  }

  function handleSearchInput() {
    const query = normalize(document.getElementById('searchInput')?.value || '');
    const match = findParcelByQuery(query);
    renderMosaic();

    if (match) {
      activeGroup = match.grupo;
      highlightedKey = parcelKey(match);
      openGroup(match.grupo, match);
      return;
    }

    if (activeGroup) {
      openGroup(activeGroup);
    }
  }

  function applyHash() {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const parcela = params.get('parcela');
    if (!parcela) return;
    const match = allEntries.find(function (item) {
      return normalize(item.parcela).toLowerCase() === normalize(parcela).toLowerCase();
    });
    if (!match) return;
    const input = document.getElementById('searchInput');
    if (input) input.value = match.parcela;
    activeGroup = match.grupo;
    highlightedKey = parcelKey(match);
    renderMosaic();
    openGroup(match.grupo, match);
  }

  function init() {
    renderMosaic();

    document.getElementById('searchInput')?.addEventListener('input', handleSearchInput);
    document.getElementById('filtroZkul')?.addEventListener('change', function () {
      renderMosaic();
      if (activeGroup) openGroup(activeGroup);
    });
    document.getElementById('filtroEstado')?.addEventListener('change', function () {
      renderMosaic();
      if (activeGroup) openGroup(activeGroup);
    });

    document.querySelector('.modal-close')?.addEventListener('click', closeParcelModal);
    document.getElementById('parcelModal')?.addEventListener('click', function (event) {
      if (event.target === event.currentTarget) closeParcelModal();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeParcelModal();
    });
    window.addEventListener('hashchange', applyHash);
    applyHash();
  }

  window.MurterApp = {
    renderMosaic: renderMosaic,
    openGroup: openGroup,
    openParcelModal: openParcelModal,
    findParcelByQuery: findParcelByQuery
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
