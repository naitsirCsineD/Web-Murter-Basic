(function () {
  const parcelas = window.PARCELAS || {};
  const allParcelas = Object.values(parcelas);

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function getEffectiveLinks() {
    return window.MurterStorage.getEffectiveLinks();
  }

  function getStatus(item) {
    const key = `${item.zkul}|${item.parcela}`;
    const link = getEffectiveLinks()[key] || { catastro: '', kmz: '' };
    const hasCatastro = normalize(link.catastro);
    const hasKmz = normalize(link.kmz);
    if (hasCatastro && hasKmz) return 'Completa';
    if (hasCatastro || hasKmz) return 'Parcial';
    return 'Pendiente';
  }

  function getStateBadge(status) {
    if (status === 'Completa') return 'state-complete';
    if (status === 'Parcial') return 'state-partial';
    return 'state-pending';
  }

  function writeRows(rows) {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    tbody.innerHTML = rows.map(function (item) {
      const key = `${item.zkul}|${item.parcela}`;
      const link = getEffectiveLinks()[key] || { catastro: '', kmz: '' };
      const hasCatastro = normalize(link.catastro);
      const hasKmz = normalize(link.kmz);
      const status = getStatus(item);

      return `
        <tr data-key="${key}">
          <td>${item.zkul}</td>
          <td>${item.parcela}</td>
          <td>${item.designacion}</td>
          <td>${hasCatastro ? 'Disponible' : 'Pendiente'}</td>
          <td>${hasKmz ? 'Disponible' : 'Pendiente'}</td>
          <td><span class="state-pill ${getStateBadge(status)}">${status}</span></td>
          <td><button type="button" class="primary-button edit-row" data-key="${key}">EDITAR</button></td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.edit-row').forEach(function (button) {
      button.addEventListener('click', function () {
        const key = button.dataset.key;
        const item = allParcelas.find(function (entry) {
          return `${entry.zkul}|${entry.parcela}` === key;
        });
        if (item) openEditModal(item);
      });
    });
  }

  function getFilteredRows() {
    const query = normalize(document.getElementById('searchInput')?.value || '');
    const zkulFilter = document.getElementById('filtroZkul')?.value || 'todos';
    const catastroFilter = document.getElementById('filtroCatastro')?.value || 'todos';
    const kmzFilter = document.getElementById('filtroKmz')?.value || 'todos';
    const pendingOnly = document.getElementById('togglePendientes')?.checked || false;

    return allParcelas.filter(function (item) {
      const key = `${item.zkul}|${item.parcela}`;
      const link = getEffectiveLinks()[key] || { catastro: '', kmz: '' };
      const matchesQuery = !query || `${item.parcela} ${item.zkul} ${item.designacion}`.toLowerCase().includes(query.toLowerCase());
      const matchesZkul = zkulFilter === 'todos' || item.zkul === zkulFilter;
      const matchesCatastro = catastroFilter === 'todos' ||
        (catastroFilter === 'con' && normalize(link.catastro)) ||
        (catastroFilter === 'sin' && !normalize(link.catastro));
      const matchesKmz = kmzFilter === 'todos' ||
        (kmzFilter === 'con' && normalize(link.kmz)) ||
        (kmzFilter === 'sin' && !normalize(link.kmz));
      const matchesPending = !pendingOnly || (!normalize(link.catastro) && !normalize(link.kmz));

      return matchesQuery && matchesZkul && matchesCatastro && matchesKmz && matchesPending;
    });
  }

  function populateFilters() {
    const zkulSet = [...new Set(allParcelas.map(function (item) { return item.zkul; }))].sort(function (a, b) {
      return Number(a) - Number(b);
    });

    const zkulSelect = document.getElementById('filtroZkul');
    zkulSet.forEach(function (zkul) {
      const option = document.createElement('option');
      option.value = zkul;
      option.textContent = zkul;
      zkulSelect.appendChild(option);
    });
  }

  function renderStats() {
    const links = getEffectiveLinks();
    const total = allParcelas.length;
    const withOfficial = Object.values(links).filter(function (record) { return normalize(record.catastro); }).length;
    const withKmz = Object.values(links).filter(function (record) { return normalize(record.kmz); }).length;
    const complete = allParcelas.filter(function (item) {
      const key = `${item.zkul}|${item.parcela}`;
      return normalize(links[key]?.catastro || '') && normalize(links[key]?.kmz || '');
    }).length;
    const pending = total - complete;

    document.getElementById('statTotal').textContent = String(total);
    document.getElementById('statOfficial').textContent = String(withOfficial);
    document.getElementById('statKmz').textContent = String(withKmz);
    document.getElementById('statComplete').textContent = String(complete);
    document.getElementById('statPending').textContent = String(pending);
  }

  function renderTable() {
    const rows = getFilteredRows();
    writeRows(rows);
    renderStats();
  }

  function validateUrl(value) {
    const trimmed = normalize(value);
    if (!trimmed) return true;
    return /^https?:\/\//i.test(trimmed);
  }

  function openEditModal(item) {
    const key = `${item.zkul}|${item.parcela}`;
    const links = getEffectiveLinks();
    const current = links[key] || { catastro: '', kmz: '' };
    const modal = document.getElementById('editModal');
    modal.dataset.key = key;
    document.getElementById('modalRegistro').value = item.zkul;
    document.getElementById('modalParcela').value = item.parcela;
    document.getElementById('modalDesignacion').value = item.designacion;
    document.getElementById('modalUrlOficial').value = current.catastro || '';
    document.getElementById('modalUrlKmz').value = current.kmz || '';

    document.getElementById('btnAbrirLink').disabled = !normalize(current.catastro);
    document.getElementById('btnAbrirKmz').disabled = !normalize(current.kmz);
    document.getElementById('btnCopiarId').dataset.copyValue = key;

    modal.classList.add('visible');
  }

  function closeModal() {
    const modal = document.getElementById('editModal');
    modal.classList.remove('visible');
    document.getElementById('alertMessage').textContent = '';
  }

  function saveCurrentItem() {
    const modal = document.getElementById('editModal');
    const key = modal.dataset.key;
    const official = normalize(document.getElementById('modalUrlOficial').value);
    const kmz = normalize(document.getElementById('modalUrlKmz').value);
    const alertBox = document.getElementById('alertMessage');

    if (official && !validateUrl(official)) {
      alertBox.textContent = 'La URL oficial no parece válida. Debe comenzar por http:// o https://';
      return;
    }

    if (kmz && !validateUrl(kmz)) {
      alertBox.textContent = 'La URL de KMZ no parece válida. Debe comenzar por http:// o https://';
      return;
    }

    const current = window.MurterStorage.getEffectiveLinks();
    current[key] = { catastro: official, kmz: kmz };
    window.MurterStorage.saveLocalLinks(current);
    renderTable();
    closeModal();
  }

  function exportJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJsConfig() {
    const links = window.MurterStorage.getEffectiveLinks();
    const content = 'window.LINKS_PARCELAS = ' + JSON.stringify(links, null, 2) + ';\n';
    const blob = new Blob([content], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'links.config.js';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const next = {};
        Object.keys(parsed).forEach(function (key) {
          next[key] = {
            catastro: normalize(parsed[key] && parsed[key].catastro ? parsed[key].catastro : ''),
            kmz: normalize(parsed[key] && parsed[key].kmz ? parsed[key].kmz : '')
          };
        });

        const confirmOverwrite = window.confirm('Se sobrescribirá la configuración local actual. ¿Continuar?');
        if (!confirmOverwrite) return;

        window.MurterStorage.saveLocalLinks(next);
        renderTable();
      } catch (error) {
        window.alert('El archivo no es un JSON válido.');
      }
    };
    reader.readAsText(file);
  }

  function init() {
    populateFilters();
    renderTable();

    document.getElementById('searchInput')?.addEventListener('input', renderTable);
    document.getElementById('filtroZkul')?.addEventListener('change', renderTable);
    document.getElementById('filtroCatastro')?.addEventListener('change', renderTable);
    document.getElementById('filtroKmz')?.addEventListener('change', renderTable);
    document.getElementById('togglePendientes')?.addEventListener('change', renderTable);

    document.getElementById('btnGuardar')?.addEventListener('click', saveCurrentItem);
    document.getElementById('btnCancelar')?.addEventListener('click', closeModal);
    document.getElementById('btnAbrirLink')?.addEventListener('click', function () {
      const key = document.getElementById('editModal').dataset.key;
      const value = window.MurterStorage.getEffectiveLinks()[key]?.catastro || '';
      if (value) window.open(value, '_blank', 'noopener,noreferrer');
    });
    document.getElementById('btnAbrirKmz')?.addEventListener('click', function () {
      const key = document.getElementById('editModal').dataset.key;
      const value = window.MurterStorage.getEffectiveLinks()[key]?.kmz || '';
      if (value) window.open(value, '_blank', 'noopener,noreferrer');
    });
    document.getElementById('btnCopiarId')?.addEventListener('click', function () {
      const value = this.dataset.copyValue || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).catch(function () {
          window.prompt('Copiar ID', value);
        });
      } else {
        window.prompt('Copiar ID', value);
      }
    });

    document.getElementById('exportJsonBtn')?.addEventListener('click', function () {
      exportJson('links.json', window.MurterStorage.getEffectiveLinks());
    });

    document.getElementById('exportJsBtn')?.addEventListener('click', exportJsConfig);
    document.getElementById('importJsonBtn')?.addEventListener('click', function () {
      document.getElementById('importInput').click();
    });
    document.getElementById('importInput')?.addEventListener('change', handleImportFile);

    document.getElementById('editModal')?.addEventListener('click', function (event) {
      if (event.target === this) closeModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
