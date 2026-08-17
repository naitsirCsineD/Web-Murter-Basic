(function () {
  const parcelas = window.PARCELAS || {};
  const allEntries = Object.entries(parcelas);

  function normalize(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function getGroupSummary() {
    const groups = {};
    allEntries.forEach(function ([key, item]) {
      const groupName = item.grupo || 'SIN GRUPO';
      if (!groups[groupName]) {
        groups[groupName] = {
          grupo: groupName,
          zkul: item.zkul || '',
          registros: [],
          totalParcels: 0,
          conLink: 0,
          conKmz: 0
        };
      }
      groups[groupName].registros.push(item);
    });

    Object.keys(groups).forEach(function (groupName) {
      const summary = groups[groupName];
      summary.totalParcels = summary.registros.length;
      const links = window.MurterStorage.getEffectiveLinks();
      summary.conLink = summary.registros.filter(function (item) {
        const record = links[`${item.zkul}|${item.parcela}`];
        return record && normalize(record.catastro || '');
      }).length;
      summary.conKmz = summary.registros.filter(function (item) {
        const record = links[`${item.zkul}|${item.parcela}`];
        return record && normalize(record.kmz || '');
      }).length;
      summary.pendientes = summary.totalParcels - summary.conLink;
    });

    return groups;
  }

  function buildCard(groupName, summary) {
    const card = document.createElement('article');
    card.className = 'property-card';
    card.dataset.group = groupName;

    card.innerHTML = `
      <div class="card-header">
        <span class="group-badge">${groupName}</span>
      </div>
      <div class="card-body">
        <div class="meta-row"><span class="meta-label">ZK. UL.</span><strong>${summary.zkul}</strong></div>
        <div class="meta-row"><span class="meta-label">Municipio</span><strong>Murter Betina</strong></div>
        <div class="stat-line">
          <span>${summary.totalParcels} parcelas</span>
          <span>${summary.conLink} enlaces</span>
          <span>${summary.conKmz} KMZ</span>
        </div>
        <div class="pending-box">${summary.pendientes} enlaces pendientes</div>
      </div>
      <div class="card-footer">
        <button type="button" class="primary-button open-group" data-group="${groupName}">VER PARCELAS</button>
      </div>
    `;

    return card;
  }

  function renderSummary(groups) {
    const totalParcels = allEntries.length;
    const links = window.MurterStorage.getEffectiveLinks();
    const totalOfficialLinks = Object.values(links).filter(function (record) {
      return normalize(record && record.catastro ? record.catastro : '');
    }).length;
    const totalKmz = Object.values(links).filter(function (record) {
      return normalize(record && record.kmz ? record.kmz : '');
    }).length;

    document.getElementById('summaryRegisters').textContent = String(Object.keys(groups).length);
    document.getElementById('summaryParcels').textContent = String(totalParcels);
    document.getElementById('summaryLinks').textContent = String(totalOfficialLinks);
    document.getElementById('summaryKmz').textContent = String(totalKmz);
  }

  function getGroupEntries(groupName) {
    return (window.PARCELAS_BY_GROUP && window.PARCELAS_BY_GROUP[groupName]) || [];
  }

  function getLinksForParcel(item) {
    const key = `${item.zkul}|${item.parcela}`;
    const links = window.MurterStorage.getEffectiveLinks();
    return links[key] || { catastro: '', kmz: '' };
  }

  function clickOpenGroup(groupName) {
    const detail = document.getElementById('detailPanel');
    const entries = getGroupEntries(groupName);
    const grupos = getGroupSummary();
    const summary = grupos[groupName] || { zkul: entries[0] ? entries[0].zkul : '', totalParcels: entries.length };

    detail.innerHTML = `
      <div class="detail-header">
        <div>
          <div class="detail-group-label">${groupName}</div>
          <h3>Registro ${summary.zkul}</h3>
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
          <tbody>
            ${entries.map(function (item) {
              const links = getLinksForParcel(item);
              const hasCatastro = normalize(links.catastro);
              const hasKmz = normalize(links.kmz);

              return `
                <tr data-key="${item.zkul}|${item.parcela}" data-parcela="${item.parcela}">
                  <td><button type="button" class="parcel-name trigger-detail" data-key="${item.zkul}|${item.parcela}">${item.parcela}</button></td>
                  <td>${item.designacion}</td>
                  <td>${item.superficie || '—'}</td>
                  <td>
                    <button type="button" class="action-chip ${hasCatastro ? 'is-active' : 'is-disabled'}" ${hasCatastro ? '' : 'disabled'} data-kind="catastro" data-key="${item.zkul}|${item.parcela}" data-url="${hasCatastro ? links.catastro : ''}">
                      ${hasCatastro ? 'VER PARCELA' : 'SIN LINK'}
                    </button>
                    ${hasCatastro ? `<button type="button" class="mini-button copy-link" data-kind="copy-catastro" data-url="${links.catastro}">COPIAR LINK</button>` : ''}
                  </td>
                  <td>
                    <button type="button" class="action-chip ${hasKmz ? 'is-success' : 'is-disabled'}" ${hasKmz ? '' : 'disabled'} data-kind="kmz" data-key="${item.zkul}|${item.parcela}" data-url="${hasKmz ? links.kmz : ''}">
                      ${hasKmz ? 'DESCARGAR KMZ' : 'SIN KMZ'}
                    </button>
                    ${hasKmz ? `<button type="button" class="mini-button copy-link" data-kind="copy-kmz" data-url="${links.kmz}">COPIAR KMZ</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    detail.classList.add('open');
    document.querySelector('.close-detail')?.addEventListener('click', function () {
      detail.classList.remove('open');
      detail.innerHTML = '';
    });

    document.querySelectorAll('.action-chip').forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.disabled) return;
        const url = button.dataset.url || '';
        if (button.dataset.kind === 'catastro') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
        if (button.dataset.kind === 'kmz') {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.download = 'parcela.kmz';
          document.body.appendChild(a);
          try {
            a.click();
          } catch (error) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
          document.body.removeChild(a);
        }
      });
    });

    document.querySelectorAll('.copy-link').forEach(function (button) {
      button.addEventListener('click', function () {
        const url = button.dataset.url || '';
        if (!url) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).catch(function () {
            window.prompt('Copiar enlace', url);
          });
        } else {
          window.prompt('Copiar enlace', url);
        }
      });
    });

    document.querySelectorAll('.trigger-detail').forEach(function (button) {
      button.addEventListener('click', function () {
        const key = button.dataset.key;
        const parcel = Object.values(parcelas).find(function (item) {
          return `${item.zkul}|${item.parcela}` === key;
        });
        if (!parcel) return;
        openParcelModal(parcel);
      });
    });
  }

  function openParcelModal(parcel) {
    const links = getLinksForParcel(parcel);
    const modal = document.getElementById('parcelModal');
    const title = `${parcel.parcela} · ${parcel.designacion}`;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalZkul').textContent = parcel.zkul;
    document.getElementById('modalParcela').textContent = parcel.parcela;
    document.getElementById('modalDesignacion').textContent = parcel.designacion;
    document.getElementById('modalSuperficie').textContent = parcel.superficie || '—';
    document.getElementById('modalCatastro').innerHTML = links.catastro ? `<a href="${links.catastro}" target="_blank" rel="noopener noreferrer">${links.catastro}</a>` : 'Sin enlace asignado';
    document.getElementById('modalKmz').innerHTML = links.kmz ? `<a href="${links.kmz}" target="_blank" rel="noopener noreferrer">${links.kmz}</a>` : 'Sin KMZ asignado';
    modal.classList.add('visible');
  }

  function renderMosaic() {
    const groups = getGroupSummary();
    const container = document.getElementById('propertyGrid');
    const orderedGroupNames = Object.keys(groups).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    container.innerHTML = '';
    orderedGroupNames.forEach(function (groupName) {
      const summary = groups[groupName];
      container.appendChild(buildCard(groupName, summary));
    });

    document.querySelectorAll('.open-group').forEach(function (button) {
      button.addEventListener('click', function () {
        clickOpenGroup(button.dataset.group);
      });
    });

    renderSummary(groups);
  }

  function findParcelByQuery(query) {
    const normalized = normalize(query).toLowerCase();
    const match = Object.values(parcelas).find(function (parcel) {
      const key = `${parcel.zkul}|${parcel.parcela}`;
      return `${parcel.parcela} ${parcel.designacion} ${parcel.zkul} ${key}`.toLowerCase().includes(normalized);
    });
    return match || null;
  }

  function attachSearchLogic() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    input.addEventListener('input', function () {
      const query = normalize(input.value);
      const propertyCards = document.querySelectorAll('.property-card');

      if (!query) {
        propertyCards.forEach(function (card) {
          card.classList.remove('is-highlighted');
        });
        return;
      }

      const match = findParcelByQuery(query);
      if (!match) {
        propertyCards.forEach(function (card) {
          card.classList.remove('is-highlighted');
        });
        return;
      }

      const groupName = match.grupo;
      propertyCards.forEach(function (card) {
        card.classList.toggle('is-highlighted', card.dataset.group === groupName);
      });
      clickOpenGroup(groupName);
    });
  }

  function init() {
    renderMosaic();
    attachSearchLogic();

    const modal = document.getElementById('parcelModal');
    document.querySelector('.modal-close')?.addEventListener('click', function () {
      modal.classList.remove('visible');
    });
    modal?.addEventListener('click', function (event) {
      if (event.target === modal) modal.classList.remove('visible');
    });
  }

  window.MurterApp = {
    renderMosaic: renderMosaic,
    clickOpenGroup: clickOpenGroup,
    openParcelModal: openParcelModal,
    findParcelByQuery: findParcelByQuery
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
