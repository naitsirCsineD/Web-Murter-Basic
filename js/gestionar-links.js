(function () {
  const parcelas = window.PARCELAS || {};
  const allParcelas = Object.values(parcelas);
  let currentRows = [];
  let currentIndex = -1;
  let pendingImport = null;

  function trimEdges(value) {
    return String(value || '').trim();
  }

  function normalizeSearch(value) {
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
    return window.MurterStorage.getEffectiveLinks();
  }

  function getLinksForItem(item) {
    return getEffectiveLinks()[parcelKey(item)] || { catastro: '', kmz: '' };
  }

  function getStatus(item) {
    const link = getLinksForItem(item);
    const hasCatastro = Boolean(trimEdges(link.catastro));
    const hasKmz = Boolean(trimEdges(link.kmz));
    if (hasCatastro && hasKmz) return 'Completa';
    if (hasCatastro || hasKmz) return 'Parcial';
    return 'Pendiente';
  }

  function getStateBadge(status) {
    if (status === 'Completa') return 'state-complete';
    if (status === 'Parcial') return 'state-partial';
    return 'state-pending';
  }

  function getFilteredRows() {
    const query = normalizeSearch(document.getElementById('searchInput')?.value || '').toLowerCase();
    const zkulFilter = document.getElementById('filtroZkul')?.value || 'todos';
    const catastroFilter = document.getElementById('filtroCatastro')?.value || 'todos';
    const kmzFilter = document.getElementById('filtroKmz')?.value || 'todos';
    const pendingOnly = document.getElementById('togglePendientes')?.checked || false;

    return allParcelas.filter(function (item) {
      const link = getLinksForItem(item);
      const hasCatastro = Boolean(trimEdges(link.catastro));
      const hasKmz = Boolean(trimEdges(link.kmz));
      const haystack = `${item.parcela} ${item.zkul} ${item.designacion} ${parcelKey(item)}`.toLowerCase();

      const matchesQuery = !query || haystack.includes(query);
      const matchesZkul = zkulFilter === 'todos' || item.zkul === zkulFilter;
      const matchesCatastro = catastroFilter === 'todos' ||
        (catastroFilter === 'con' && hasCatastro) ||
        (catastroFilter === 'sin' && !hasCatastro);
      const matchesKmz = kmzFilter === 'todos' ||
        (kmzFilter === 'con' && hasKmz) ||
        (kmzFilter === 'sin' && !hasKmz);
      const matchesPending = !pendingOnly || (!hasCatastro && !hasKmz);

      return matchesQuery && matchesZkul && matchesCatastro && matchesKmz && matchesPending;
    });
  }

  function writeRows(rows) {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No hay parcelas para los filtros activos.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (item) {
      const key = parcelKey(item);
      const link = getLinksForItem(item);
      const hasCatastro = Boolean(trimEdges(link.catastro));
      const hasKmz = Boolean(trimEdges(link.kmz));
      const status = getStatus(item);

      return `
        <tr data-key="${escapeAttr(key)}">
          <td>${escapeHtml(item.zkul)}</td>
          <td>${escapeHtml(item.parcela)}</td>
          <td>${escapeHtml(item.designacion)}</td>
          <td>${hasCatastro ? 'Disponible' : 'Pendiente'}</td>
          <td>${hasKmz ? 'Disponible' : 'Pendiente'}</td>
          <td><span class="state-pill ${getStateBadge(status)}">${status}</span></td>
          <td><button type="button" class="primary-button edit-row" data-key="${escapeAttr(key)}">EDITAR</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.edit-row').forEach(function (button) {
      button.addEventListener('click', function () {
        const index = currentRows.findIndex(function (item) {
          return parcelKey(item) === button.dataset.key;
        });
        if (index >= 0) openEditModal(index);
      });
    });
  }

  function populateFilters() {
    const zkulSelect = document.getElementById('filtroZkul');
    if (!zkulSelect || zkulSelect.dataset.ready === 'true') return;

    [...new Set(allParcelas.map(function (item) { return item.zkul; }))]
      .sort(function (a, b) { return Number(a) - Number(b); })
      .forEach(function (zkul) {
        const option = document.createElement('option');
        option.value = zkul;
        option.textContent = zkul;
        zkulSelect.appendChild(option);
      });

    zkulSelect.dataset.ready = 'true';
  }

  function renderStats() {
    const links = getEffectiveLinks();
    const knownKeys = new Set(allParcelas.map(parcelKey));
    const total = allParcelas.length;
    const withOfficial = Object.keys(links).filter(function (key) {
      return knownKeys.has(key) && trimEdges(links[key].catastro);
    }).length;
    const withKmz = Object.keys(links).filter(function (key) {
      return knownKeys.has(key) && trimEdges(links[key].kmz);
    }).length;
    const complete = allParcelas.filter(function (item) {
      const link = getLinksForItem(item);
      return trimEdges(link.catastro) && trimEdges(link.kmz);
    }).length;
    const pending = allParcelas.filter(function (item) {
      const link = getLinksForItem(item);
      return !trimEdges(link.catastro) && !trimEdges(link.kmz);
    }).length;

    document.getElementById('statTotal').textContent = String(total);
    document.getElementById('statOfficial').textContent = String(withOfficial);
    document.getElementById('statKmz').textContent = String(withKmz);
    document.getElementById('statComplete').textContent = String(complete);
    document.getElementById('statPending').textContent = String(pending);
  }

  function renderTable() {
    currentRows = getFilteredRows();
    writeRows(currentRows);
    renderStats();
  }

  function validateUrl(value) {
    const trimmed = trimEdges(value);
    if (!trimmed) return true;
    return /^https?:\/\//i.test(trimmed);
  }

  function setAlert(message) {
    const alertBox = document.getElementById('alertMessage');
    if (alertBox) alertBox.textContent = message || '';
  }

  function openEditModal(index) {
    const item = currentRows[index];
    if (!item) return;

    currentIndex = index;
    const key = parcelKey(item);
    const current = getLinksForItem(item);
    const modal = document.getElementById('editModal');
    modal.dataset.key = key;
    modal.setAttribute('aria-hidden', 'false');

    document.getElementById('modalRegistro').value = item.zkul;
    document.getElementById('modalParcela').value = item.parcela;
    document.getElementById('modalDesignacion').value = item.designacion;
    document.getElementById('modalUrlOficial').value = current.catastro || '';
    document.getElementById('modalUrlKmz').value = current.kmz || '';
    document.getElementById('btnCopiarId').dataset.copyValue = key;
    setAlert('');
    updateModalButtons();
    modal.classList.add('visible');
  }

  function updateModalButtons() {
    const key = document.getElementById('editModal')?.dataset.key || '';
    const links = getEffectiveLinks()[key] || { catastro: '', kmz: '' };
    const hasCatastro = Boolean(trimEdges(links.catastro));
    const hasKmz = Boolean(trimEdges(links.kmz));

    document.getElementById('btnAbrirLink').disabled = !hasCatastro;
    document.getElementById('btnCopiarLink').disabled = !hasCatastro;
    document.getElementById('btnAbrirKmz').disabled = !hasKmz;
    document.getElementById('btnCopiarKmz').disabled = !hasKmz;
    document.getElementById('btnAnterior').disabled = currentIndex <= 0;
    document.getElementById('btnSiguiente').disabled = currentIndex >= currentRows.length - 1;
  }

  function closeModal() {
    const modal = document.getElementById('editModal');
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    currentIndex = -1;
    setAlert('');
  }

  function saveCurrentItem(options) {
    const shouldStayOpen = options && options.stayOpen;
    const modal = document.getElementById('editModal');
    const key = modal.dataset.key;
    const official = trimEdges(document.getElementById('modalUrlOficial').value);
    const kmz = trimEdges(document.getElementById('modalUrlKmz').value);

    if (official && !validateUrl(official)) {
      setAlert('La URL oficial no parece válida. Debe comenzar por http:// o https://. Puede corregirla o cancelar.');
      return false;
    }

    if (kmz && !validateUrl(kmz)) {
      setAlert('La URL de KMZ no parece válida. Debe comenzar por http:// o https://. Puede corregirla o cancelar.');
      return false;
    }

    const localLinks = window.MurterStorage.readLocalLinks();
    localLinks[key] = { catastro: official, kmz: kmz };
    window.MurterStorage.saveLocalLinks(localLinks);
    renderTable();

    if (!shouldStayOpen) {
      closeModal();
    } else {
      updateModalButtons();
      setAlert('Guardado localmente en este navegador.');
    }
    return true;
  }

  function moveModal(delta) {
    const oldIndex = currentIndex;
    const saved = saveCurrentItem({ stayOpen: true });
    if (!saved) return;

    const nextIndex = delta > 0 ? Math.min(oldIndex, currentRows.length - 1) : Math.max(oldIndex - 1, 0);
    if (nextIndex < 0 || nextIndex >= currentRows.length) return;
    openEditModal(nextIndex);
  }

  function openCurrentUrl(kind) {
    const key = document.getElementById('editModal').dataset.key;
    const value = getEffectiveLinks()[key]?.[kind] || '';
    if (value) window.open(value, '_blank', 'noopener,noreferrer');
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

  function copyCurrentUrl(kind, label) {
    const key = document.getElementById('editModal').dataset.key;
    const value = getEffectiveLinks()[key]?.[kind] || '';
    copyText(value, label);
  }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    downloadText('links.json', JSON.stringify(getEffectiveLinks(), null, 2), 'application/json');
  }

  function exportJsConfig() {
    const content = 'window.LINKS_PARCELAS = ' + JSON.stringify(getEffectiveLinks(), null, 2) + ';\n';
    downloadText('links.config.js', content, 'application/javascript');
  }

  function normalizeImportedLinks(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('El JSON debe ser un objeto.');
    }

    const next = {};
    Object.keys(parsed).forEach(function (key) {
      const value = parsed[key] || {};
      next[key] = {
        catastro: typeof value.catastro === 'string' ? value.catastro.trim() : '',
        kmz: typeof value.kmz === 'string' ? value.kmz.trim() : ''
      };
    });
    return next;
  }

  function openConfirmImport(next) {
    pendingImport = next;
    const modal = document.getElementById('confirmModal');
    const localCount = Object.keys(window.MurterStorage.readLocalLinks()).length;
    document.getElementById('confirmMessage').textContent =
      `Se importarán ${Object.keys(next).length} registros y se sobrescribirá la configuración local actual (${localCount} registros).`;
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeConfirmImport() {
    pendingImport = null;
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
  }

  function acceptImport() {
    if (!pendingImport) return;
    window.MurterStorage.saveLocalLinks(pendingImport);
    renderTable();
    closeConfirmImport();
  }

  function clearLocalOverrides() {
    const confirmed = window.confirm('Se borrarán los cambios guardados solo en este navegador y se usarán los datos publicados del sitio. ¿Continuar?');
    if (!confirmed) return;
    window.MurterStorage.clearLocalLinks();
    renderTable();
    window.alert('Configuración local borrada. Ahora se están usando los datos publicados.');
  }

  function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        openConfirmImport(normalizeImportedLinks(parsed));
      } catch (error) {
        window.alert('El archivo no es un JSON válido.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    document.getElementById('searchInput')?.addEventListener('input', renderTable);
    document.getElementById('filtroZkul')?.addEventListener('change', renderTable);
    document.getElementById('filtroCatastro')?.addEventListener('change', renderTable);
    document.getElementById('filtroKmz')?.addEventListener('change', renderTable);
    document.getElementById('togglePendientes')?.addEventListener('change', renderTable);

    document.getElementById('btnGuardar')?.addEventListener('click', function () { saveCurrentItem(); });
    document.getElementById('btnCancelar')?.addEventListener('click', closeModal);
    document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
    document.getElementById('btnAnterior')?.addEventListener('click', function () { moveModal(-1); });
    document.getElementById('btnSiguiente')?.addEventListener('click', function () { moveModal(1); });

    document.getElementById('btnAbrirLink')?.addEventListener('click', function () { openCurrentUrl('catastro'); });
    document.getElementById('btnAbrirKmz')?.addEventListener('click', function () { openCurrentUrl('kmz'); });
    document.getElementById('btnCopiarLink')?.addEventListener('click', function () { copyCurrentUrl('catastro', 'Copiar link oficial'); });
    document.getElementById('btnCopiarKmz')?.addEventListener('click', function () { copyCurrentUrl('kmz', 'Copiar KMZ'); });
    document.getElementById('btnCopiarId')?.addEventListener('click', function () {
      copyText(this.dataset.copyValue || '', 'Copiar ID');
    });

    document.getElementById('exportJsonBtn')?.addEventListener('click', exportJson);
    document.getElementById('exportJsBtn')?.addEventListener('click', exportJsConfig);
    document.getElementById('clearLocalBtn')?.addEventListener('click', clearLocalOverrides);
    document.getElementById('importJsonBtn')?.addEventListener('click', function () {
      document.getElementById('importInput').click();
    });
    document.getElementById('importInput')?.addEventListener('change', handleImportFile);

    document.getElementById('confirmCancel')?.addEventListener('click', closeConfirmImport);
    document.getElementById('confirmAccept')?.addEventListener('click', acceptImport);
    document.getElementById('editModal')?.addEventListener('click', function (event) {
      if (event.target === this) closeModal();
    });
  }

  function init() {
    populateFilters();
    renderTable();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
