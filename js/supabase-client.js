// ============================================================
//  supabase-client.js  –  Datenschicht
//  Enthält KEINE Credentials, nur Query-Logik.
//  Credentials kommen aus config.js (SUPABASE_CONFIG).
// ============================================================

const DataService = (() => {
  let _client = null;

  /** Supabase-Client initialisieren */
  function init() {
    if (typeof SUPABASE_CONFIG === 'undefined') {
      throw new Error(
        'SUPABASE_CONFIG nicht gefunden. Bitte js/config.js anlegen ' +
        '(siehe js/config.example.js).'
      );
    }
    _client = supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey
    );
    return _client;
  }

  /** Hilfsfunktion: Query ausführen, Fehler werfen */
  async function _query(queryFn) {
    const { data, error } = await queryFn(_client);
    if (error) throw new Error(`Supabase-Fehler: ${error.message}`);
    return data;
  }

  // ----------------------------------------------------------
  //  Öffentliche Query-Methoden
  // ----------------------------------------------------------

  /** Alle Rohdaten (gefiltert) laden — paginiert, da Supabase max. 1000 Zeilen liefert */
  async function fetchFiltered({ year, segment, region } = {}) {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await (() => {
        let q = _client.from('train').select(
          'order_id, order_date, customer_id, customer_name, segment, region, sales'
        );
        if (year)    q = q.gte('order_date', `${year}-01-01`).lte('order_date', `${year}-12-31`);
        if (segment) q = q.eq('segment', segment);
        if (region)  q = q.eq('region', region);
        return q.range(from, from + PAGE_SIZE - 1);
      })();

      if (error) throw new Error(`Supabase-Fehler: ${error.message}`);
      allData = allData.concat(data);
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    return allData;
  }

  /** Eindeutige Jahre auslesen */
  async function fetchYears() {
    return _query(async (sb) =>
      sb.from('train')
        .select('order_date')
        .order('order_date', { ascending: true })
    );
  }

  /** Eindeutige Segmente */
  async function fetchSegments() {
    return _query(async (sb) =>
      sb.from('train').select('segment')
    );
  }

  /** Eindeutige Regionen */
  async function fetchRegions() {
    return _query(async (sb) =>
      sb.from('train').select('region')
    );
  }

  // ----------------------------------------------------------
  //  Aggregations-Logik (clientseitig, da Supabase REST
  //  keine GROUP BY mit DISTINCT COUNT unterstützt)
  // ----------------------------------------------------------

  /** KPIs aus Rohdaten berechnen */
  function computeKPIs(rows) {
    const customers   = new Set(rows.map(r => r.customer_id));
    const orders      = new Set(rows.map(r => r.order_id));
    const totalSales  = rows.reduce((s, r) => s + (r.sales || 0), 0);

    return {
      totalCustomers:    customers.size,
      totalOrders:       orders.size,
      totalSales:        totalSales,
      revenuePerCustomer: customers.size ? totalSales / customers.size : 0,
      ordersPerCustomer:  customers.size ? orders.size / customers.size : 0
    };
  }

  /** Kunden pro Jahr */
  function customersByYear(rows) {
    const map = {};
    rows.forEach(r => {
      const y = r.order_date?.substring(0, 4);
      if (!y) return;
      if (!map[y]) map[y] = new Set();
      map[y].add(r.customer_id);
    });
    return Object.keys(map).sort().map(y => ({
      year: y,
      count: map[y].size
    }));
  }

  /** Kunden pro Segment */
  function customersBySegment(rows) {
    const map = {};
    rows.forEach(r => {
      if (!map[r.segment]) map[r.segment] = new Set();
      map[r.segment].add(r.customer_id);
    });
    return Object.entries(map).map(([seg, set]) => ({
      segment: seg,
      count: set.size
    })).sort((a, b) => b.count - a.count);
  }

  /** Kunden pro Region */
  function customersByRegion(rows) {
    const map = {};
    rows.forEach(r => {
      if (!map[r.region]) map[r.region] = new Set();
      map[r.region].add(r.customer_id);
    });
    return Object.entries(map).map(([reg, set]) => ({
      region: reg,
      count: set.size
    })).sort((a, b) => b.count - a.count);
  }

  /** Top N Kunden nach Umsatz */
  function topCustomersBySales(rows, n = 10) {
    const map = {};
    rows.forEach(r => {
      if (!map[r.customer_id]) map[r.customer_id] = { name: r.customer_name, sales: 0 };
      map[r.customer_id].sales += r.sales || 0;
    });
    return Object.values(map)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, n);
  }

  /** Neukunden eines Jahres (erstmals bestellt) */
  function newCustomersInYear(rows, targetYear) {
    const firstOrder = {};
    rows.forEach(r => {
      const y = r.order_date?.substring(0, 4);
      if (!y) return;
      if (!firstOrder[r.customer_id] || y < firstOrder[r.customer_id]) {
        firstOrder[r.customer_id] = y;
      }
    });
    return Object.values(firstOrder).filter(y => y === String(targetYear)).length;
  }

  // ----------------------------------------------------------
  return {
    init,
    fetchFiltered,
    fetchYears,
    fetchSegments,
    fetchRegions,
    computeKPIs,
    customersByYear,
    customersBySegment,
    customersByRegion,
    topCustomersBySales,
    newCustomersInYear
  };
})();
