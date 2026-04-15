// ============================================================
//  dashboard.js  –  UI-Schicht (v2)
//  Hichert SUCCESS: Botschafts-Titel, Datenlabels, Deltas
//  Enthält KEINE Datenbank-Logik.
// ============================================================

// Register datalabels plugin globally
Chart.register(ChartDataLabels);

const Dashboard = (() => {
  const _charts = {};

  // ── Farben ──
  const C = {
    primary:      '#4a6fa5',
    primaryLight: '#a8bed6',
    primaryPale:  '#d6e3f0',
    highlight:    '#2c5282',
    accent:       '#c0392b',
    positive:     '#2e7d32',
    negative:     '#c0392b',
    muted:        '#6b7280',
    segments:     ['#4a6fa5', '#6b8ebf', '#a8bed6'],
    regions:      ['#4a6fa5', '#6b8ebf', '#8aaccc', '#a8bed6']
  };

  // ── Formatierung ──
  const fmt = {
    n:   v => new Intl.NumberFormat('de-DE').format(Math.round(v)),
    cur: v => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' $',
    k:   v => v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : fmt.n(v),
    pct: (v, sign = true) => (sign && v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' %',
    dec: (v, d = 1) => v.toFixed(d).replace('.', ',')
  };

  // ── Gemeinsame Chart-Defaults ──
  const FONT = { family: "'Segoe UI', system-ui, sans-serif" };
  const GRID_COLOR = '#eef0f2';

  function baseScales(opts = {}) {
    return {
      x: {
        grid: { display: false },
        ticks: { font: { ...FONT, size: 11 }, color: C.muted },
        border: { display: false },
        ...opts.x
      },
      y: {
        grid: { color: GRID_COLOR, drawBorder: false },
        ticks: { font: { ...FONT, size: 11 }, color: C.muted },
        border: { display: false },
        beginAtZero: true,
        ...opts.y
      }
    };
  }

  function tooltipConfig() {
    return {
      backgroundColor: '#1a1f36',
      titleFont: { ...FONT, size: 12, weight: '600' },
      bodyFont: { ...FONT, size: 12 },
      padding: 10,
      cornerRadius: 4,
      displayColors: false
    };
  }

  // ── Chart erstellen/aktualisieren ──
  function _make(id, config) {
    if (_charts[id]) _charts[id].destroy();
    _charts[id] = new Chart(document.getElementById(id), config);
  }

  // ==============================================================
  //  KPI-KARTEN
  // ==============================================================
  function renderKPIs(rows, allRows) {
    const kpis = DataService.computeKPIs(rows);

    // Jahresdaten für Deltas
    const byYear = DataService.customersByYear(allRows);
    const years = byYear.map(d => d.year);
    const latestYear = years[years.length - 1];
    const prevYear   = years.length >= 2 ? years[years.length - 2] : null;

    // KPIs für letztes und vorletztes Jahr
    const rowsLatest = allRows.filter(r => r.order_date?.startsWith(latestYear));
    const rowsPrev   = prevYear ? allRows.filter(r => r.order_date?.startsWith(prevYear)) : [];
    const kLatest = DataService.computeKPIs(rowsLatest);
    const kPrev   = rowsPrev.length ? DataService.computeKPIs(rowsPrev) : null;

    // ─ Kunden gesamt ─
    document.getElementById('kpi-total-customers').textContent = fmt.n(kpis.totalCustomers);
    if (kPrev) {
      const delta = ((kLatest.totalCustomers - kPrev.totalCustomers) / kPrev.totalCustomers * 100);
      setDelta('kpi-total-delta', delta, `${fmt.pct(delta)} vs. ${prevYear}`);
    }
    document.getElementById('kpi-total-detail').textContent =
      `${fmt.n(kpis.totalOrders)} Bestellungen · ${fmt.cur(kpis.totalSales)} Umsatz`;

    // ─ Umsatz pro Kunde ─
    document.getElementById('kpi-rev-per-customer').textContent = fmt.cur(kpis.revenuePerCustomer);
    if (kPrev) {
      const delta = ((kLatest.revenuePerCustomer - kPrev.revenuePerCustomer) / kPrev.revenuePerCustomer * 100);
      setDelta('kpi-rev-delta', delta, `${fmt.pct(delta)} vs. ${prevYear}`);
    }
    document.getElementById('kpi-rev-detail').textContent =
      `Ø über alle ${fmt.n(kpis.totalCustomers)} Kunden · ${years[0]}–${latestYear}`;

    // ─ Bestellungen pro Kunde ─
    document.getElementById('kpi-orders-per-customer').textContent = fmt.dec(kpis.ordersPerCustomer);
    if (kPrev) {
      const delta = ((kLatest.ordersPerCustomer - kPrev.ordersPerCustomer) / kPrev.ordersPerCustomer * 100);
      setDelta('kpi-orders-delta', delta, `${fmt.pct(delta)} vs. ${prevYear}`);
    }
    document.getElementById('kpi-orders-detail').textContent = `Ø Bestellungen pro Kunde · ${years[0]}–${latestYear}`;

    // ─ Neukunden ─
    const newLatest = DataService.newCustomersInYear(allRows, parseInt(latestYear));
    const newPrev   = prevYear ? DataService.newCustomersInYear(allRows, parseInt(prevYear)) : null;
    document.getElementById('kpi-new-customers').textContent = fmt.n(newLatest);
    if (newPrev !== null && newPrev > 0) {
      const delta = ((newLatest - newPrev) / newPrev * 100);
      setDelta('kpi-new-delta', delta, `${fmt.pct(delta)} vs. ${newPrev} in ${prevYear}`);
    }
    document.getElementById('kpi-new-detail').textContent = `Erstmalig in ${latestYear} bestellt`;
  }

  function setDelta(id, value, text) {
    const el = document.getElementById(id);
    if (!el) return;
    const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '●';
    el.textContent = `${arrow} ${text}`;
    el.className = 'kpi-card__delta ' + (value > 0.5 ? 'positive' : value < -0.5 ? 'negative' : 'neutral');
  }

  // ==============================================================
  //  CHART 1: Kunden nach Jahren (Balken + Datenlabels)
  // ==============================================================
  function renderCustomersByYear(data) {
    const first = data[0], last = data[data.length - 1];
    const growth = ((last.count - first.count) / first.count * 100);
    document.getElementById('title-customers-year').textContent =
      `Kundenbasis wächst stetig – von ${fmt.n(first.count)} auf ${fmt.n(last.count)} (${fmt.pct(growth)})`;
    document.getElementById('subtitle-customers-year').textContent =
      `Eindeutige Kunden pro Jahr · ${first.year}–${last.year} · Quelle: Superstore DB`;

    const maxVal = Math.max(...data.map(d => d.count));

    _make('chart-customers-year', {
      type: 'bar',
      data: {
        labels: data.map(d => d.year),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: data.map(d =>
            d.count === maxVal ? C.highlight : C.primary
          ),
          borderRadius: 2,
          maxBarThickness: 64
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipConfig(), callbacks: { label: ctx => `${fmt.n(ctx.parsed.y)} Kunden` } },
          datalabels: {
            anchor: 'end', align: 'end', offset: 4,
            font: { ...FONT, size: 12, weight: '700' },
            color: C.primary,
            formatter: v => fmt.n(v)
          }
        },
        scales: baseScales({
          y: { ticks: { display: false }, grid: { display: false }, border: { display: false } }
        }),
        layout: { padding: { top: 28 } }
      }
    });
  }

  // ==============================================================
  //  CHART 2: Kunden nach Segment (Donut + Prozent-Labels)
  // ==============================================================
  function renderCustomersBySegment(data) {
    const total = data.reduce((s, d) => s + d.count, 0);
    const top = data[0];
    const topPct = (top.count / total * 100);

    document.getElementById('title-segment').textContent =
      `${top.segment} dominiert mit ${fmt.pct(topPct, false)} aller Kunden`;
    document.getElementById('subtitle-segment').textContent =
      `${fmt.n(total)} Kunden nach Kundensegment · Anteile in %`;

    _make('chart-segment', {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.segment),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: C.segments,
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { ...FONT, size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 10 }
          },
          tooltip: {
            ...tooltipConfig(),
            callbacks: {
              label: ctx => {
                const pct = (ctx.parsed / total * 100).toFixed(1);
                return ` ${ctx.label}: ${fmt.n(ctx.parsed)} Kunden (${pct} %)`;
              }
            }
          },
          datalabels: {
            color: '#ffffff',
            font: { ...FONT, size: 13, weight: '700' },
            formatter: (v) => {
              const p = (v / total * 100);
              return p >= 10 ? fmt.pct(p, false) : '';
            }
          }
        }
      }
    });
  }

  // ==============================================================
  //  CHART 3: Top 10 Kunden (Horizontal + Umsatz-Labels)
  // ==============================================================
  function renderTopCustomers(data, totalSales) {
    const top10Sales = data.reduce((s, d) => s + d.sales, 0);
    const top10Pct = (top10Sales / totalSales * 100);

    document.getElementById('title-top-customers').textContent =
      `Top 10 generieren ${fmt.pct(top10Pct, false)} des Gesamtumsatzes`;
    document.getElementById('subtitle-top-customers').textContent =
      `Kumulierter Umsatz in $ · alle Jahre · Gesamtumsatz: ${fmt.cur(totalSales)}`;

    _make('chart-top-customers', {
      type: 'bar',
      data: {
        labels: data.map(d => d.name),
        datasets: [{
          data: data.map(d => d.sales),
          backgroundColor: data.map((_, i) => i === 0 ? C.highlight : C.primaryLight),
          borderRadius: 2,
          maxBarThickness: 28
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            grid: { color: GRID_COLOR, drawBorder: false },
            border: { display: false },
            ticks: { display: false },
            max: Math.max(...data.map(d => d.sales)) * 1.25
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { ...FONT, size: 11 }, color: '#1a1f36', crossAlign: 'far' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipConfig(),
            callbacks: {
              label: ctx => {
                const pct = (ctx.parsed.x / totalSales * 100).toFixed(1);
                return ` ${fmt.cur(ctx.parsed.x)} (${pct} %)`;
              }
            }
          },
          datalabels: {
            anchor: 'end', align: 'end', offset: 6,
            font: { ...FONT, size: 11, weight: '600' },
            color: C.muted,
            formatter: v => fmt.k(v) + ' $'
          }
        },
        layout: { padding: { right: 60 } }
      }
    });
  }

  // ==============================================================
  //  CHART 4: Kunden nach Region (Balken + Labels)
  // ==============================================================
  function renderCustomersByRegion(data) {
    const topReg = data[0];
    const botReg = data[data.length - 1];
    const gap = ((topReg.count - botReg.count) / botReg.count * 100);

    document.getElementById('title-region').textContent =
      `${topReg.region} führt – ${botReg.region} ${fmt.pct(gap, false)} dahinter`;
    document.getElementById('subtitle-region').textContent =
      `Eindeutige Kunden pro Region · alle Jahre`;

    const maxVal = Math.max(...data.map(d => d.count));

    _make('chart-region', {
      type: 'bar',
      data: {
        labels: data.map(d => d.region),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: data.map(d =>
            d.count === maxVal ? C.highlight : C.primaryLight
          ),
          borderRadius: 2,
          maxBarThickness: 52
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipConfig(), callbacks: { label: ctx => `${fmt.n(ctx.parsed.y)} Kunden` } },
          datalabels: {
            anchor: 'end', align: 'end', offset: 4,
            font: { ...FONT, size: 12, weight: '700' },
            color: C.primary,
            formatter: v => fmt.n(v)
          }
        },
        scales: baseScales({
          y: { ticks: { display: false }, grid: { display: false }, border: { display: false } }
        }),
        layout: { padding: { top: 28 } }
      }
    });
  }

  // ==============================================================
  //  INSIGHT-BOX
  // ==============================================================
  function renderInsight(rows, allRows) {
    const box = document.getElementById('insight-box');
    const kpis = DataService.computeKPIs(rows);
    const byYear = DataService.customersByYear(allRows);
    if (byYear.length < 2) return;

    const first = byYear[0], last = byYear[byYear.length - 1];
    const growthPct = ((last.count - first.count) / first.count * 100).toFixed(1);
    const newLast = DataService.newCustomersInYear(allRows, parseInt(last.year));
    const retPct = (((last.count - newLast) / last.count) * 100).toFixed(0);

    box.innerHTML =
      `<strong>Kundenentwicklung:</strong> Die aktive Kundenbasis wuchs von ` +
      `${fmt.n(first.count)} (${first.year}) auf ${fmt.n(last.count)} (${last.year}) = <strong>+${growthPct} %</strong>. ` +
      `Das Wachstum wird primär durch Bestandskunden getrieben: <strong>${retPct} %</strong> der Kunden in ${last.year} ` +
      `hatten bereits zuvor bestellt, nur ${fmt.n(newLast)} waren Neukunden. ` +
      `Im Durchschnitt generiert jeder Kunde <strong>${fmt.cur(kpis.revenuePerCustomer)}</strong> Umsatz ` +
      `bei <strong>${fmt.dec(kpis.ordersPerCustomer)}</strong> Bestellungen.`;
  }

  // ==============================================================
  //  FILTER BEFÜLLEN
  // ==============================================================
  async function populateFilters(allRows) {
    const years = [...new Set(allRows.map(r => r.order_date?.substring(0, 4)).filter(Boolean))].sort();
    const yearSel = document.getElementById('filter-year');
    years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearSel.appendChild(o); });

    const segs = [...new Set(allRows.map(r => r.segment).filter(Boolean))].sort();
    const segSel = document.getElementById('filter-segment');
    segs.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; segSel.appendChild(o); });

    const regs = [...new Set(allRows.map(r => r.region).filter(Boolean))].sort();
    const regSel = document.getElementById('filter-region');
    regs.forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = r; regSel.appendChild(o); });
  }

  // ==============================================================
  //  HAUPT-RENDER
  // ==============================================================
  function render(rows, allRows) {
    const kpis      = DataService.computeKPIs(rows);
    const byYear    = DataService.customersByYear(rows);
    const bySegment = DataService.customersBySegment(rows);
    const byRegion  = DataService.customersByRegion(rows);
    const topCust   = DataService.topCustomersBySales(rows, 10);

    renderKPIs(rows, allRows);
    renderCustomersByYear(byYear);
    renderCustomersBySegment(bySegment);
    renderTopCustomers(topCust, kpis.totalSales);
    renderCustomersByRegion(byRegion);
    renderInsight(rows, allRows);
  }

  return { render, populateFilters };
})();


// ============================================================
//  Bootstrap
// ============================================================
(async function main() {
  const $loading   = document.getElementById('loading');
  const $error     = document.getElementById('error');
  const $dashboard = document.getElementById('dashboard');

  try {
    DataService.init();
    const allRows = await DataService.fetchFiltered();

    await Dashboard.populateFilters(allRows);

    $loading.classList.add('hidden');
    $dashboard.classList.remove('hidden');
    Dashboard.render(allRows, allRows);

    ['filter-year', 'filter-segment', 'filter-region'].forEach(id => {
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
