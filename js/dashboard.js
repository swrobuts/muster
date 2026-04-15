// ============================================================
//  dashboard.js  –  UI-Schicht
//  Enthält KEINE Datenbank-Logik, nur Rendering & Interaktion.
// ============================================================

const Dashboard = (() => {
  // Chart.js-Instanzen (für Updates/Destroys)
  const _charts = {};

  // Farben aus dem Design-System
  const COLORS = {
    primary:      '#4a6fa5',
    primaryLight: '#a8bed6',
    primaryPale:  '#d6e3f0',
    accent:       '#c0392b',
    segments: ['#4a6fa5', '#6b8ebf', '#a8bed6'],
    regions:  ['#4a6fa5', '#6b8ebf', '#8aaccc', '#a8bed6']
  };

  // Gemeinsame Chart.js-Optionen (Hichert-Stil)
  const BASE_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1f36',
        titleFont: { size: 12 },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 4,
        callbacks: {}
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#6b7280' }
      },
      y: {
        grid: { color: '#f0f0f0', drawBorder: false },
        ticks: { font: { size: 11 }, color: '#6b7280' },
        beginAtZero: true
      }
    }
  };

  // ----------------------------------------------------------
  //  Formatierung
  // ----------------------------------------------------------
  function fmtNumber(n) {
    return new Intl.NumberFormat('de-DE').format(Math.round(n));
  }
  function fmtCurrency(n) {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(n)) + ' $';
  }
  function fmtPercent(n) {
    const sign = n >= 0 ? '+' : '';
    return sign + n.toFixed(1) + ' %';
  }

  // ----------------------------------------------------------
  //  KPI-Karten rendern
  // ----------------------------------------------------------
  function renderKPIs(kpis, allRows) {
    document.getElementById('kpi-total-customers').textContent = fmtNumber(kpis.totalCustomers);
    document.getElementById('kpi-total-detail').textContent =
      `${fmtNumber(kpis.totalOrders)} Bestellungen · ${fmtCurrency(kpis.totalSales)} Umsatz`;

    document.getElementById('kpi-rev-per-customer').textContent = fmtCurrency(kpis.revenuePerCustomer);
    document.getElementById('kpi-rev-detail').textContent = 'Ø Umsatz pro Kunde';

    document.getElementById('kpi-orders-per-customer').textContent =
      kpis.ordersPerCustomer.toFixed(1);
    document.getElementById('kpi-orders-detail').textContent = 'Ø Bestellungen pro Kunde';

    const newCount = DataService.newCustomersInYear(allRows, 2018);
    document.getElementById('kpi-new-customers').textContent = fmtNumber(newCount);
    document.getElementById('kpi-new-detail').textContent = 'Erstmalig im Jahr 2018 bestellt';
  }

  // ----------------------------------------------------------
  //  Charts erstellen / aktualisieren
  // ----------------------------------------------------------
  function _createOrUpdate(id, config) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    if (_charts[id]) _charts[id].destroy();
    _charts[id] = new Chart(ctx, config);
  }

  function renderCustomersByYear(data) {
    _createOrUpdate('chart-customers-year', {
      type: 'bar',
      data: {
        labels: data.map(d => d.year),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: COLORS.primary,
          borderRadius: 2,
          maxBarThickness: 60
        }]
      },
      options: {
        ...BASE_OPTIONS,
        plugins: {
          ...BASE_OPTIONS.plugins,
          tooltip: {
            ...BASE_OPTIONS.plugins.tooltip,
            callbacks: {
              label: ctx => `${fmtNumber(ctx.parsed.y)} Kunden`
            }
          },
          datalabels: undefined
        }
      }
    });
  }

  function renderCustomersBySegment(data) {
    _createOrUpdate('chart-segment', {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.segment),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: COLORS.segments,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 12 }, padding: 16, usePointStyle: true }
          },
          tooltip: {
            ...BASE_OPTIONS.plugins.tooltip,
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${fmtNumber(ctx.parsed)} (${pct} %)`;
              }
            }
          }
        }
      }
    });
  }

  function renderTopCustomers(data) {
    _createOrUpdate('chart-top-customers', {
      type: 'bar',
      data: {
        labels: data.map(d => d.name),
        datasets: [{
          data: data.map(d => d.sales),
          backgroundColor: data.map((_, i) => i === 0 ? COLORS.primary : COLORS.primaryLight),
          borderRadius: 2,
          maxBarThickness: 40
        }]
      },
      options: {
        ...BASE_OPTIONS,
        indexAxis: 'y',
        scales: {
          x: {
            grid: { color: '#f0f0f0', drawBorder: false },
            ticks: {
              font: { size: 11 },
              color: '#6b7280',
              callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v
            }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#6b7280' }
          }
        },
        plugins: {
          ...BASE_OPTIONS.plugins,
          tooltip: {
            ...BASE_OPTIONS.plugins.tooltip,
            callbacks: {
              label: ctx => ` ${fmtCurrency(ctx.parsed.x)}`
            }
          }
        }
      }
    });
  }

  function renderCustomersByRegion(data) {
    _createOrUpdate('chart-region', {
      type: 'bar',
      data: {
        labels: data.map(d => d.region),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: COLORS.regions,
          borderRadius: 2,
          maxBarThickness: 50
        }]
      },
      options: {
        ...BASE_OPTIONS,
        plugins: {
          ...BASE_OPTIONS.plugins,
          tooltip: {
            ...BASE_OPTIONS.plugins.tooltip,
            callbacks: {
              label: ctx => `${fmtNumber(ctx.parsed.y)} Kunden`
            }
          }
        }
      }
    });
  }

  // ----------------------------------------------------------
  //  Insight-Box rendern
  // ----------------------------------------------------------
  function renderInsight(kpis, byYear) {
    const box = document.getElementById('insight-box');
    if (!box || byYear.length < 2) return;
    const first = byYear[0];
    const last  = byYear[byYear.length - 1];
    const growth = ((last.count - first.count) / first.count * 100).toFixed(1);
    box.innerHTML =
      `<strong>Kundenentwicklung:</strong> Die Kundenbasis wuchs von ` +
      `${fmtNumber(first.count)} (${first.year}) auf ${fmtNumber(last.count)} (${last.year}), ` +
      `ein Zuwachs von ${growth} %. ` +
      `Im Durchschnitt generiert jeder Kunde ${fmtCurrency(kpis.revenuePerCustomer)} Umsatz ` +
      `bei ${kpis.ordersPerCustomer.toFixed(1)} Bestellungen.`;
  }

  // ----------------------------------------------------------
  //  Filter befüllen
  // ----------------------------------------------------------
  async function populateFilters(allRows) {
    // Jahre
    const years = [...new Set(allRows.map(r => r.order_date?.substring(0, 4)).filter(Boolean))].sort();
    const yearSel = document.getElementById('filter-year');
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      yearSel.appendChild(opt);
    });

    // Segmente
    const segs = [...new Set(allRows.map(r => r.segment).filter(Boolean))].sort();
    const segSel = document.getElementById('filter-segment');
    segs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      segSel.appendChild(opt);
    });

    // Regionen
    const regs = [...new Set(allRows.map(r => r.region).filter(Boolean))].sort();
    const regSel = document.getElementById('filter-region');
    regs.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      regSel.appendChild(opt);
    });
  }

  // ----------------------------------------------------------
  //  Haupt-Render-Funktion
  // ----------------------------------------------------------
  function render(rows, allRows) {
    const kpis      = DataService.computeKPIs(rows);
    const byYear    = DataService.customersByYear(rows);
    const bySegment = DataService.customersBySegment(rows);
    const byRegion  = DataService.customersByRegion(rows);
    const topCust   = DataService.topCustomersBySales(rows, 10);

    renderKPIs(kpis, allRows);
    renderCustomersByYear(byYear);
    renderCustomersBySegment(bySegment);
    renderTopCustomers(topCust);
    renderCustomersByRegion(byRegion);
    renderInsight(kpis, byYear);
  }

  return { render, populateFilters };
})();


// ============================================================
//  Bootstrap: Alles zusammenführen
// ============================================================
(async function main() {
  const $loading   = document.getElementById('loading');
  const $error     = document.getElementById('error');
  const $dashboard = document.getElementById('dashboard');

  try {
    // 1. Supabase initialisieren
    DataService.init();

    // 2. Alle Daten laden (für Filter + Neukunden-Berechnung)
    const allRows = await DataService.fetchFiltered();

    // 3. Filter befüllen
    await Dashboard.populateFilters(allRows);

    // 4. Dashboard rendern
    $loading.classList.add('hidden');
    $dashboard.classList.remove('hidden');
    Dashboard.render(allRows, allRows);

    // 5. Filter-Events
    const filterIds = ['filter-year', 'filter-segment', 'filter-region'];
    filterIds.forEach(id => {
      document.getElementById(id).addEventListener('change', async () => {
        const year    = document.getElementById('filter-year').value;
        const segment = document.getElementById('filter-segment').value;
        const region  = document.getElementById('filter-region').value;

        const filtered = await DataService.fetchFiltered({ year, segment, region });
        Dashboard.render(filtered, allRows);
      });
    });

  } catch (err) {
    console.error(err);
    $loading.classList.add('hidden');
    $error.textContent = err.message;
    $error.classList.remove('hidden');
  }
})();
