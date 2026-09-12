import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import {
  Wrench,
  Search,
  Filter,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Layers,
  Cpu,
  MapPin,
  ShieldCheck,
  Check,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Download,
  Building2,
  Activity,
  ArrowUpRight,
  ClipboardCheck,
  FileCheck,
  PackageCheck,
  Boxes,
  Tag,
  FileSpreadsheet,
  LayoutGrid,
  ListFilter,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  Sliders
} from 'lucide-react';

function cleanVal(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.endsWith('.0') && !isNaN(Number(str))) {
    str = str.slice(0, -2);
  }
  return str;
}

function parseDateSafe(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  const parts = clean.split('-');
  if (parts.length === 3) {
    let y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (y > 2100) y = 2026; // Fix anomalous typo years like 20526
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d);
    }
  }
  return null;
}

function formatDateStr(dateStr) {
  if (!dateStr || dateStr === '-' || dateStr === 'NA') return '-';
  const d = parseDateSafe(dateStr);
  if (!d) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function App({ data, updateItem, deleteItem, insertItem, moveItem, followLink }) {
  // Navigation & View state
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'tasks' | 'rca' | 'branches'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterProduct, setFilterProduct] = useState('ALL');
  const [filterWarranty, setFilterWarranty] = useState('ALL');
  const [filterBU, setFilterBU] = useState('ALL');
  const [filterTAT, setFilterTAT] = useState('ALL'); // 'ALL' | 'SAME_DAY' | '1_2_DAYS' | '3_PLUS'
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Responsive & Mobile controls
  const [mobileViewMode, setMobileViewMode] = useState('auto'); // 'auto' | 'cards' | 'table'
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState('taskDate');
  const [sortDir, setSortDir] = useState('desc');

  // Modals
  const [viewingItem, setViewingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Dynamic Column Mapping
  const colMap = useMemo(() => {
    const hRow = data?.find(
      (d) => d.row && (d.row.includes('SPRR / RMR') || d.row.includes('Task No.') || d.row.includes('SI. No.'))
    );
    if (!hRow) {
      return {
        slNo: 0,
        type: 1,
        receivedOn: 2,
        taskNo: 3,
        taskDate: 4,
        customer: 5,
        bu: 6,
        tl: 7,
        product: 8,
        model: 9,
        machineNo: 10,
        capacity: 11,
        partName: 12,
        warranty: 13,
        problem: 14,
        rca: 15,
        actionTaken: 16,
        sparePartCode: 17,
        checkListNo: 18,
        checkDate: 19,
        girNo: 20,
        completed: 21,
        girDate: 22,
        resolutionDays: 23,
        remarks: 24,
      };
    }
    const r = hRow.row;
    const findCol = (predicate, fallback) => {
      const idx = r.findIndex((c) => typeof c === 'string' && predicate(c.toLowerCase().trim()));
      return idx !== -1 ? idx : fallback;
    };

    return {
      slNo: findCol((c) => c.includes('si. no') || c.includes('sl. no'), 0),
      type: findCol((c) => c.includes('sprr') || c.includes('rmr'), 1),
      receivedOn: findCol((c) => c.includes('received'), 2),
      taskNo: findCol((c) => c.includes('task no'), 3),
      taskDate: findCol((c) => c.includes('task date'), 4),
      customer: findCol((c) => c.includes('customer') || c.includes('reseller'), 5),
      bu: findCol((c) => c.includes('bu name') || c.includes('branch'), 6),
      tl: findCol((c) => c.includes('tl name'), 7),
      product: findCol((c) => c === 'product' || c.includes('product'), 8),
      model: findCol((c) => c === 'model', 9),
      machineNo: findCol((c) => c.includes('machine number') || c.includes('machine no'), 10),
      capacity: findCol((c) => c === 'capacity', 11),
      partName: findCol((c) => c.includes('part name'), 12),
      warranty: findCol((c) => c.includes('warranty'), 13),
      problem: findCol((c) => c.includes('problem'), 14),
      rca: findCol((c) => c.includes('rca') || c.includes('observation'), 15),
      actionTaken: findCol((c) => c.includes('spare replaced') || c.includes('action taken'), 16),
      sparePartCode: findCol((c) => c.includes('spare part code'), 17),
      checkListNo: findCol((c) => c.includes('check list') || c.includes('checklist'), 18),
      checkDate: findCol((c) => c.includes('check date'), 19),
      girNo: findCol((c) => c.includes('gir no'), 20),
      completed: findCol((c) => c.includes('completed'), 21),
      girDate: findCol((c) => c.includes('gir date'), 22),
      resolutionDays: findCol((c) => c.includes('reolution') || c.includes('resolution'), 23),
      remarks: findCol((c) => c.includes('remarks'), 24),
    };
  }, [data]);

  // Clean data array
  const validRows = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const hRow = data.find(
      (d) => d.row && (d.row.includes('SPRR / RMR') || d.row.includes('Task No.') || d.row.includes('SI. No.'))
    );
    const headerIndex = hRow ? hRow.index_ : 1;

    return data
      .filter((d) => {
        if (d.index_ <= headerIndex) return false;
        const r = d.row;
        if (!r) return false;
        return Boolean(r[colMap.type] || r[colMap.taskNo] || r[colMap.customer] || r[colMap.model]);
      })
      .map((d) => {
        const r = d.row;
        const rawRes = r[colMap.resolutionDays];
        let resDays = null;
        if (rawRes !== null && rawRes !== undefined && rawRes !== '') {
          const num = Number(rawRes);
          if (!isNaN(num)) resDays = num;
        }

        const taskType = r[colMap.type] ? String(r[colMap.type]).trim().toUpperCase() : 'SPRR';
        const warrantyVal = r[colMap.warranty] ? String(r[colMap.warranty]).trim() : 'Warranty';
        const productVal = r[colMap.product] ? String(r[colMap.product]).trim() : 'EWS';

        return {
          index_: d.index_,
          slNo: cleanVal(r[colMap.slNo]) || String(d.index_),
          type: taskType.includes('RMR') ? 'RMR' : 'SPRR',
          receivedOn: cleanVal(r[colMap.receivedOn]),
          taskNo: cleanVal(r[colMap.taskNo]),
          taskDate: cleanVal(r[colMap.taskDate]),
          customer: cleanVal(r[colMap.customer]) || 'Unnamed Customer',
          bu: cleanVal(r[colMap.bu]) || 'General',
          tl: cleanVal(r[colMap.tl]) || 'N/A',
          product: productVal || 'EWS',
          model: cleanVal(r[colMap.model]) || 'Unspecified',
          machineNo: cleanVal(r[colMap.machineNo]) || '-',
          capacity: cleanVal(r[colMap.capacity]) || '-',
          partName: cleanVal(r[colMap.partName]) || 'WS-MAIN BOARD',
          warranty: warrantyVal,
          problem: cleanVal(r[colMap.problem]) || '-',
          rca: cleanVal(r[colMap.rca]) || '-',
          actionTaken: cleanVal(r[colMap.actionTaken]) || '-',
          sparePartCode: cleanVal(r[colMap.sparePartCode]) || '-',
          checkListNo: cleanVal(r[colMap.checkListNo]) || '-',
          checkDate: cleanVal(r[colMap.checkDate]) || '-',
          girNo: cleanVal(r[colMap.girNo]) || '-',
          completed: cleanVal(r[colMap.completed]) || '-',
          girDate: cleanVal(r[colMap.girDate]) || '-',
          resolutionDays: resDays,
          remarks: cleanVal(r[colMap.remarks]) || '',
          rawRow: r,
        };
      });
  }, [data, colMap]);

  // Derived Filter Options
  const buList = useMemo(() => {
    const set = new Set();
    validRows.forEach((r) => {
      if (r.bu && r.bu !== 'General' && r.bu !== '-') set.add(r.bu);
    });
    return Array.from(set).sort();
  }, [validRows]);

  const productList = useMemo(() => {
    const set = new Set();
    validRows.forEach((r) => {
      if (r.product && r.product !== '-') set.add(r.product);
    });
    return Array.from(set).sort();
  }, [validRows]);

  // Computed KPIs
  const stats = useMemo(() => {
    const total = validRows.length;
    if (total === 0) {
      return {
        total: 0,
        sprrCount: 0,
        rmrCount: 0,
        warrantyCount: 0,
        ascCount: 0,
        outWarrantyCount: 0,
        avgTAT: 0,
        sameDayCount: 0,
        sameDayRate: 0,
        productCounts: {},
        girTrackedCount: 0,
        fclCheckedCount: 0,
      };
    }

    let sprr = 0;
    let rmr = 0;
    let inWarranty = 0;
    let asc = 0;
    let outWarranty = 0;
    let sameDay = 0;
    let tatSum = 0;
    let tatCount = 0;
    let girCount = 0;
    let fclCount = 0;
    const prodCounts = {};

    validRows.forEach((r) => {
      if (r.type === 'RMR') rmr++;
      else sprr++;

      const p = r.product || 'EWS';
      prodCounts[p] = (prodCounts[p] || 0) + 1;

      const w = r.warranty.toLowerCase();
      if (w.includes('out')) outWarranty++;
      else if (w.includes('asc')) asc++;
      else inWarranty++;

      if (r.girNo && r.girNo !== '-' && r.girNo !== 'NA') {
        girCount++;
      }

      if (r.checkListNo && r.checkListNo !== '-' && r.checkListNo !== 'NA') {
        fclCount++;
      }

      if (r.resolutionDays !== null && r.resolutionDays >= 0) {
        tatSum += r.resolutionDays;
        tatCount++;
        if (r.resolutionDays === 0) sameDay++;
      }
    });

    const avgTAT = tatCount > 0 ? (tatSum / tatCount).toFixed(1) : '0.0';
    const sameDayRate = tatCount > 0 ? ((sameDay / tatCount) * 100).toFixed(1) : '0.0';

    return {
      total,
      sprrCount: sprr,
      rmrCount: rmr,
      warrantyCount: inWarranty,
      ascCount: asc,
      outWarrantyCount: outWarranty,
      avgTAT,
      sameDayCount: sameDay,
      sameDayRate,
      productCounts: prodCounts,
      girTrackedCount: girCount,
      fclCheckedCount: fclCount,
    };
  }, [validRows]);

  // Monthly trends for visualization
  const monthlyData = useMemo(() => {
    const map = new Map();
    validRows.forEach((r) => {
      const dateStr = r.taskDate || r.receivedOn;
      const parsed = parseDateSafe(dateStr);
      let monthKey = 'Other';
      if (parsed) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        monthKey = `${months[parsed.getMonth()]} ${parsed.getFullYear()}`;
      }
      if (!map.has(monthKey)) {
        map.set(monthKey, {
          month: monthKey,
          total: 0,
          sprr: 0,
          rmr: 0,
          tatSum: 0,
          tatCount: 0,
        });
      }
      const item = map.get(monthKey);
      item.total++;
      if (r.type === 'RMR') item.rmr++;
      else item.sprr++;
      if (r.resolutionDays !== null && r.resolutionDays >= 0) {
        item.tatSum += r.resolutionDays;
        item.tatCount++;
      }
    });

    return Array.from(map.values()).map((m) => ({
      ...m,
      avgTat: m.tatCount > 0 ? +(m.tatSum / m.tatCount).toFixed(1) : 0,
    }));
  }, [validRows]);

  // Top RCA Breakdown
  const topRCAData = useMemo(() => {
    const counts = {};
    validRows.forEach((r) => {
      let reason = r.rca;
      if (!reason || reason === '-' || reason.toLowerCase().includes('working fine')) return;
      reason = reason.trim();
      counts[reason] = (counts[reason] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percent: ((count / validRows.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [validRows]);

  // Top BU Data
  const buPerformance = useMemo(() => {
    const counts = {};
    validRows.forEach((r) => {
      const bu = r.bu || 'Unassigned';
      if (!counts[bu]) {
        counts[bu] = { bu, total: 0, sprr: 0, rmr: 0, tatSum: 0, tatCount: 0 };
      }
      counts[bu].total++;
      if (r.type === 'RMR') counts[bu].rmr++;
      else counts[bu].sprr++;
      if (r.resolutionDays !== null && r.resolutionDays >= 0) {
        counts[bu].tatSum += r.resolutionDays;
        counts[bu].tatCount++;
      }
    });

    return Object.values(counts)
      .map((b) => ({
        ...b,
        avgTat: b.tatCount > 0 ? +(b.tatSum / b.tatCount).toFixed(1) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [validRows]);

  // Top Models Affected
  const modelBreakdown = useMemo(() => {
    const counts = {};
    validRows.forEach((r) => {
      const m = r.model || 'Other';
      counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [validRows]);

  // Top Replaced Parts
  const topPartsData = useMemo(() => {
    const counts = {};
    validRows.forEach((r) => {
      const p = r.partName || 'Other';
      if (p !== '-') counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([part, count]) => ({ part, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [validRows]);

  // Filtered & Sorted Rows
  const filteredRows = useMemo(() => {
    return validRows.filter((r) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          r.customer.toLowerCase().includes(q) ||
          r.taskNo.toLowerCase().includes(q) ||
          r.product.toLowerCase().includes(q) ||
          r.girNo.toLowerCase().includes(q) ||
          r.checkListNo.toLowerCase().includes(q) ||
          r.machineNo.toLowerCase().includes(q) ||
          r.problem.toLowerCase().includes(q) ||
          r.rca.toLowerCase().includes(q) ||
          r.bu.toLowerCase().includes(q) ||
          r.model.toLowerCase().includes(q) ||
          r.partName.toLowerCase().includes(q) ||
          r.actionTaken.toLowerCase().includes(q) ||
          r.remarks.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Type Filter
      if (filterType !== 'ALL' && r.type !== filterType) return false;

      // Product Filter
      if (filterProduct !== 'ALL' && r.product !== filterProduct) return false;

      // Warranty Filter
      if (filterWarranty !== 'ALL') {
        const w = r.warranty.toLowerCase();
        if (filterWarranty === 'WARRANTY' && (!w.includes('warranty') || w.includes('out'))) return false;
        if (filterWarranty === 'ASC' && !w.includes('asc')) return false;
        if (filterWarranty === 'OUT_OF_WARRANTY' && !w.includes('out')) return false;
      }

      // BU Filter
      if (filterBU !== 'ALL' && r.bu !== filterBU) return false;

      // TAT Filter
      if (filterTAT !== 'ALL') {
        if (filterTAT === 'SAME_DAY' && r.resolutionDays !== 0) return false;
        if (filterTAT === '1_2_DAYS' && (r.resolutionDays === null || r.resolutionDays < 1 || r.resolutionDays > 2))
          return false;
        if (filterTAT === '3_PLUS' && (r.resolutionDays === null || r.resolutionDays < 3)) return false;
      }

      // Date Range Filter (From Date & To Date)
      if (filterFromDate || filterToDate) {
        const rowDateStr = r.taskDate || r.receivedOn;
        const rowDate = parseDateSafe(rowDateStr);
        if (rowDate) {
          const rowTime = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate()).getTime();
          if (filterFromDate) {
            const fromD = parseDateSafe(filterFromDate);
            if (fromD) {
              const fromTime = new Date(fromD.getFullYear(), fromD.getMonth(), fromD.getDate()).getTime();
              if (rowTime < fromTime) return false;
            }
          }
          if (filterToDate) {
            const toD = parseDateSafe(filterToDate);
            if (toD) {
              const toTime = new Date(toD.getFullYear(), toD.getMonth(), toD.getDate()).getTime();
              if (rowTime > toTime) return false;
            }
          }
        } else {
          return false;
        }
      }

      return true;
    });
  }, [validRows, searchQuery, filterType, filterProduct, filterWarranty, filterBU, filterTAT, filterFromDate, filterToDate]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'resolutionDays') {
        aVal = aVal === null ? -999 : Number(aVal);
        bVal = bVal === null ? -999 : Number(bVal);
      } else if (sortField === 'taskDate' || sortField === 'receivedOn' || sortField === 'checkDate' || sortField === 'girDate') {
        const aDate = parseDateSafe(aVal)?.getTime() || 0;
        const bDate = parseDateSafe(bVal)?.getTime() || 0;
        return sortDir === 'asc' ? aDate - bDate : bDate - aDate;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortField, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // Handlers for Mutations
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleUpdateItemSubmit = (updated) => {
    if (!editingItem) return;
    const oldRow = editingItem.rawRow || new Array(25).fill(null);
    const newRow = [...oldRow];

    newRow[colMap.type] = updated.type;
    newRow[colMap.receivedOn] = updated.receivedOn;
    newRow[colMap.taskNo] = updated.taskNo;
    newRow[colMap.taskDate] = updated.taskDate;
    newRow[colMap.customer] = updated.customer;
    newRow[colMap.bu] = updated.bu;
    newRow[colMap.tl] = updated.tl;
    newRow[colMap.product] = updated.product;
    newRow[colMap.model] = updated.model;
    newRow[colMap.machineNo] = updated.machineNo;
    newRow[colMap.capacity] = updated.capacity;
    newRow[colMap.partName] = updated.partName;
    newRow[colMap.warranty] = updated.warranty;
    newRow[colMap.problem] = updated.problem;
    newRow[colMap.rca] = updated.rca;
    newRow[colMap.actionTaken] = updated.actionTaken;
    newRow[colMap.sparePartCode] = updated.sparePartCode;
    newRow[colMap.checkListNo] = updated.checkListNo;
    newRow[colMap.checkDate] = updated.checkDate;
    newRow[colMap.girNo] = updated.girNo;
    newRow[colMap.completed] = updated.completed;
    newRow[colMap.girDate] = updated.girDate;
    newRow[colMap.resolutionDays] =
      updated.resolutionDays === '' || updated.resolutionDays === null ? null : Number(updated.resolutionDays);
    newRow[colMap.remarks] = updated.remarks;

    updateItem(editingItem.index_, newRow);
    setEditingItem(null);
    triggerToast(`Task #${updated.taskNo || editingItem.taskNo} updated successfully`);
  };

  const handleCreateItemSubmit = (newItem) => {
    const maxSlNo = validRows.reduce((max, r) => {
      const n = Number(r.slNo);
      return !isNaN(n) && n > max ? n : max;
    }, 0);

    const activeFilterCount = [
      filterType !== 'ALL',
      filterProduct !== 'ALL',
      filterWarranty !== 'ALL',
      filterBU !== 'ALL',
      filterTAT !== 'ALL',
      Boolean(searchQuery.trim())
    ].filter(Boolean).length;

    const rowArray = new Array(25).fill(null);
    rowArray[colMap.slNo] = maxSlNo + 1;
    rowArray[colMap.type] = newItem.type || 'SPRR';
    rowArray[colMap.receivedOn] = newItem.receivedOn || new Date().toISOString().split('T')[0];
    rowArray[colMap.taskNo] = newItem.taskNo || Math.floor(840000 + Math.random() * 90000);
    rowArray[colMap.taskDate] = newItem.taskDate || new Date().toISOString().split('T')[0];
    rowArray[colMap.customer] = newItem.customer || 'New Customer';
    rowArray[colMap.bu] = newItem.bu || 'Pune';
    rowArray[colMap.tl] = newItem.tl || 'AKB';
    rowArray[colMap.product] = newItem.product || 'EWS';
    rowArray[colMap.model] = newItem.model || 'DX / DF / DS Series';
    rowArray[colMap.machineNo] = newItem.machineNo || '-';
    rowArray[colMap.capacity] = newItem.capacity || '30KG';
    rowArray[colMap.partName] = newItem.partName || 'WS-MAIN BOARD';
    rowArray[colMap.warranty] = newItem.warranty || 'Warranty';
    rowArray[colMap.problem] = newItem.problem || 'No Display';
    rowArray[colMap.rca] = newItem.rca || 'No Display';
    rowArray[colMap.actionTaken] = newItem.actionTaken || 'Replaced IC';
    rowArray[colMap.sparePartCode] = newItem.sparePartCode || '';
    rowArray[colMap.checkListNo] = newItem.checkListNo || '';
    rowArray[colMap.checkDate] = newItem.checkDate || new Date().toISOString().split('T')[0];
    rowArray[colMap.girNo] = newItem.girNo || (newItem.type === 'RMR' ? '131000' : 'NA');
    rowArray[colMap.completed] = newItem.completed || new Date().toISOString().split('T')[0];
    rowArray[colMap.girDate] = newItem.girDate || '';
    rowArray[colMap.resolutionDays] =
      newItem.resolutionDays !== '' && newItem.resolutionDays !== undefined ? Number(newItem.resolutionDays) : 1;
    rowArray[colMap.remarks] = newItem.remarks || '';

    insertItem(undefined, rowArray);
    setIsAddModalOpen(false);
    triggerToast(`New task registered successfully`);
  };

  const handleDeleteItem = (index_) => {
    deleteItem(index_);
    setDeleteConfirmIndex(null);
    triggerToast(`Task record deleted`);
  };

  const handleExportCSV = () => {
    const headers = [
      'Sl No',
      'Type',
      'Task No',
      'Task Date',
      'Received On',
      'Customer',
      'Branch / BU',
      'Team Lead',
      'Product',
      'Model',
      'Machine No',
      'Capacity',
      'Part Name',
      'Warranty',
      'Problem Description',
      'CSC Observation / RCA',
      'Action Taken',
      'Spare Part Code',
      'Functional Check List No',
      'Functional Check Date',
      'GIR No for RMR',
      'GIR Date',
      'Completed Date',
      'Resolution Days (TAT)',
      'Remarks'
    ];

    const rows = sortedRows.map((r) => [
      `"${r.slNo}"`,
      `"${r.type}"`,
      `"${r.taskNo}"`,
      `"${r.taskDate}"`,
      `"${r.receivedOn}"`,
      `"${r.customer.replace(/"/g, '""')}"`,
      `"${r.bu}"`,
      `"${r.tl}"`,
      `"${r.product}"`,
      `"${r.model}"`,
      `"${r.machineNo}"`,
      `"${r.capacity}"`,
      `"${r.partName}"`,
      `"${r.warranty}"`,
      `"${r.problem.replace(/"/g, '""')}"`,
      `"${r.rca.replace(/"/g, '""')}"`,
      `"${r.actionTaken.replace(/"/g, '""')}"`,
      `"${r.sparePartCode}"`,
      `"${r.checkListNo}"`,
      `"${r.checkDate}"`,
      `"${r.girNo}"`,
      `"${r.girDate}"`,
      `"${r.completed}"`,
      r.resolutionDays !== null ? r.resolutionDays : '',
      `"${r.remarks.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CSC_Service_Tasks_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(`Exported ${sortedRows.length} tasks to CSV`);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterType !== 'ALL') count++;
    if (filterProduct !== 'ALL') count++;
    if (filterWarranty !== 'ALL') count++;
    if (filterBU !== 'ALL') count++;
    if (filterTAT !== 'ALL') count++;
    if (filterFromDate) count++;
    if (filterToDate) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [filterType, filterProduct, filterWarranty, filterBU, filterTAT, filterFromDate, filterToDate, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center justify-between sm:justify-start gap-3 border border-slate-700 animate-fade-in text-xs sm:text-sm">
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-2.5 sm:py-0 sm:h-16 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 tracking-tight truncate">
                    CSC DASHBOARD - EWS GDT POS
                  </h1>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200 shrink-0">
                    Live Sync
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 truncate hidden xs:block">
                  SPRR & RMR Inspection, Quality Check & Resolution Hub
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={handleExportCSV}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                title="Export complete dataset to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Export CSV
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs shadow-blue-600/20 transition cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline">New Task</span>
                <span className="xs:hidden">New</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs with smooth touch scrolling */}
          <div className="flex space-x-1 sm:space-x-3 border-t border-slate-100 overflow-x-auto py-1 scrollbar-none touch-pan-x">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium rounded-lg transition whitespace-nowrap shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium rounded-lg transition whitespace-nowrap shrink-0 ${
                activeTab === 'tasks'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Task Register</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">
                {validRows.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('rca')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium rounded-lg transition whitespace-nowrap shrink-0 ${
                activeTab === 'rca'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Product & RCA</span>
            </button>
            <button
              onClick={() => setActiveTab('branches')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium rounded-lg transition whitespace-nowrap shrink-0 ${
                activeTab === 'branches'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Branches</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container - Responsive touch padding for mobile & tablet navigation */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24 sm:pb-16 lg:pb-6">
        {/* Responsive KPI Strip */}
        <section className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-medium">Total Tasks</span>
              <div className="p-1 sm:p-1.5 bg-blue-50 text-blue-600 rounded-md">
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold text-slate-900">{stats.total}</span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">Registered</span>
            </div>
            <div className="mt-2 text-[10px] sm:text-[11px] text-slate-500 flex flex-wrap gap-1 pt-2 border-t border-slate-100">
              <span className="text-blue-600 font-semibold">{stats.sprrCount} SPRR</span>
              <span>•</span>
              <span className="text-violet-600 font-semibold">{stats.rmrCount} RMR</span>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-medium">Avg TAT</span>
              <div className="p-1 sm:p-1.5 bg-amber-50 text-amber-600 rounded-md">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold text-slate-900">{stats.avgTAT}</span>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-600">Days</span>
            </div>
            <div className="mt-2 text-[10px] sm:text-[11px] text-emerald-600 font-medium flex items-center gap-1 pt-2 border-t border-slate-100 truncate">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">{stats.sameDayRate}% Same-Day (0d)</span>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-medium">Product Mix</span>
              <div className="p-1 sm:p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold text-indigo-700">
                {stats.productCounts['EWS'] || 0}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-slate-500">EWS Units</span>
            </div>
            <div className="mt-2 text-[10px] sm:text-[11px] text-slate-600 pt-2 border-t border-slate-100 flex justify-between">
              <span>GDT: <strong>{stats.productCounts['GDT'] || 0}</strong></span>
              <span className="text-slate-400 font-mono text-[10px]">{stats.fclCheckedCount} QA</span>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-medium">Warranty</span>
              <div className="p-1 sm:p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold text-emerald-600">{stats.warrantyCount}</span>
              <span className="text-[10px] sm:text-xs text-slate-500">
                {stats.total ? ((stats.warrantyCount / stats.total) * 100).toFixed(0) : 0}%
              </span>
            </div>
            <div className="mt-2 text-[10px] sm:text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
              <span>ASC: {stats.ascCount}</span>
              <span>Out: {stats.outWarrantyCount}</span>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-medium">Active Branches</span>
              <div className="p-1 sm:p-1.5 bg-purple-50 text-purple-600 rounded-md">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold text-slate-900">{buList.length}</span>
              <span className="text-[10px] sm:text-xs text-slate-500">Branches</span>
            </div>
            <div className="mt-2 text-[10px] sm:text-[11px] text-slate-500 pt-2 border-t border-slate-100 truncate">
              Top: <strong className="text-slate-800">{buPerformance[0]?.bu || 'None'}</strong> ({buPerformance[0]?.total || 0})
            </div>
          </div>
        </section>

        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Monthly Service Velocity Chart */}
              <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      Monthly Inflow & Resolution Volume
                    </h3>
                    <p className="text-xs text-slate-500">
                      Breakdown of Spare Replacement (SPRR) vs Returned Material (RMR)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <span className="w-3 h-3 rounded-xs bg-blue-500 inline-block" />
                      SPRR
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <span className="w-3 h-3 rounded-xs bg-violet-500 inline-block" />
                      RMR
                    </span>
                  </div>
                </div>

                <div className="mt-4 h-64 w-full">
                  <TimelineBarChart data={monthlyData} />
                </div>
              </div>

              {/* Warranty vs Contract Status Distribution */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Warranty Coverage Mix
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Ratio of In-Warranty claims vs ASC and Out-of-Warranty
                  </p>

                  <div className="h-44 flex items-center justify-center">
                    <WarrantyDonutChart
                      warrantyCount={stats.warrantyCount}
                      ascCount={stats.ascCount}
                      outCount={stats.outWarrantyCount}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      In Warranty
                    </span>
                    <span className="font-semibold text-slate-900">
                      {stats.warrantyCount}{' '}
                      <span className="text-slate-400 font-normal">
                        ({stats.total ? ((stats.warrantyCount / stats.total) * 100).toFixed(0) : 0}%)
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      ASC (Service Contract)
                    </span>
                    <span className="font-semibold text-slate-900">
                      {stats.ascCount}{' '}
                      <span className="text-slate-400 font-normal">
                        ({stats.total ? ((stats.ascCount / stats.total) * 100).toFixed(0) : 0}%)
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      Out of Warranty
                    </span>
                    <span className="font-semibold text-slate-900">
                      {stats.outWarrantyCount}{' '}
                      <span className="text-slate-400 font-normal">
                        ({stats.total ? ((stats.outWarrantyCount / stats.total) * 100).toFixed(0) : 0}%)
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Primary Failure Root Causes */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Frequent Observations & Failure Modes (RCA)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Identified faults during CSC inspection
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('rca')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    Details <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {topRCAData.map((item, idx) => {
                    const maxVal = topRCAData[0]?.count || 1;
                    const pctWidth = Math.max(8, Math.round((item.count / maxVal) * 100));
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-700 truncate max-w-[280px]">
                            {item.name}
                          </span>
                          <span className="text-slate-500 font-semibold">
                            {item.count} <span className="text-slate-400 font-normal">({item.percent}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${pctWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Branch Volume Leaderboard */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-purple-600" />
                      Top Service Branches (BU Load & Avg TAT)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ticket volume and mean turnaround duration in days
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('branches')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    View All <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-3 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 font-semibold">
                        <th className="py-2">Branch / BU</th>
                        <th className="py-2 text-center">SPRR</th>
                        <th className="py-2 text-center">RMR</th>
                        <th className="py-2 text-right">Total</th>
                        <th className="py-2 text-right">Avg TAT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {buPerformance.slice(0, 6).map((b, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 font-medium text-slate-800 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            {b.bu}
                          </td>
                          <td className="py-2.5 text-center text-slate-600">{b.sprr}</td>
                          <td className="py-2.5 text-center text-slate-600">{b.rmr}</td>
                          <td className="py-2.5 text-right font-bold text-slate-900">{b.total}</td>
                          <td className="py-2.5 text-right">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                b.avgTat <= 1
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : b.avgTat <= 2.5
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {b.avgTat}d
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TASK REGISTER (FULL DIRECTORY WITH FILTERS & RESPONSIVE VIEW MODES) */}
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Filter Bar with Mobile & Tablet Adaptations */}
            <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch md:items-center justify-between">
                {/* Search Bar with touch accessibility */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search customer, task #, product, GIR #, checklist #, machine #, RCA..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-8 py-2 sm:py-1.5 text-sm sm:text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Mobile & Tablet Filter Toggle & View Switcher */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                    className={`md:hidden min-h-[38px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                      activeFilterCount > 0 || isMobileFilterOpen
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {/* Mode switcher: Cards vs Table on mobile/tablet/desktop */}
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                    <button
                      onClick={() => setMobileViewMode('cards')}
                      className={`min-h-[34px] px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1 font-semibold transition cursor-pointer ${
                        mobileViewMode === 'cards' || (mobileViewMode === 'auto')
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Card view (optimized for phones and tablets)"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Cards</span>
                    </button>
                    <button
                      onClick={() => setMobileViewMode('table')}
                      className={`min-h-[34px] px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1 font-semibold transition cursor-pointer ${
                        mobileViewMode === 'table'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Table view (spreadsheet grid)"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Table</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter Dropdowns: Collapsible on Mobile, Grid on Tablet & Desktop */}
              <div
                className={`${
                  isMobileFilterOpen ? 'block' : 'hidden md:block'
                } pt-2 border-t border-slate-200/80 md:border-0 md:pt-0`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-sm sm:text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  >
                    <option value="ALL">All Types (SPRR & RMR)</option>
                    <option value="SPRR">SPRR Only</option>
                    <option value="RMR">RMR Only</option>
                  </select>

                  <select
                    value={filterProduct}
                    onChange={(e) => {
                      setFilterProduct(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-sm sm:text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  >
                    <option value="ALL">All Products (EWS / GDT)</option>
                    {productList.map((p) => (
                      <option key={p} value={p}>
                        Product: {p}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterWarranty}
                    onChange={(e) => {
                      setFilterWarranty(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-sm sm:text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  >
                    <option value="ALL">All Warranty Status</option>
                    <option value="WARRANTY">In Warranty</option>
                    <option value="ASC">ASC</option>
                    <option value="OUT_OF_WARRANTY">Out of Warranty</option>
                  </select>

                  <select
                    value={filterBU}
                    onChange={(e) => {
                      setFilterBU(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-sm sm:text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  >
                    <option value="ALL">All Branches ({buList.length})</option>
                    {buList.map((bu) => (
                      <option key={bu} value={bu}>
                        {bu}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterTAT}
                    onChange={(e) => {
                      setFilterTAT(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-sm sm:text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  >
                    <option value="ALL">All Resolution Speed</option>
                    <option value="SAME_DAY">Same Day (0 Days)</option>
                    <option value="1_2_DAYS">1 - 2 Days</option>
                    <option value="3_PLUS">3+ Days (Extended)</option>
                  </select>
                </div>

                {/* Date Range Filters (From & To Date) */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 mt-2">
                  <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs shadow-2xs">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-600 font-medium whitespace-nowrap">From Date:</span>
                    <input
                      type="date"
                      value={filterFromDate}
                      onChange={(e) => {
                        setFilterFromDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="text-xs text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                    />
                    {filterFromDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterFromDate('');
                          setCurrentPage(1);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title="Clear From Date"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs shadow-2xs">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-600 font-medium whitespace-nowrap">To Date:</span>
                    <input
                      type="date"
                      value={filterToDate}
                      onChange={(e) => {
                        setFilterToDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="text-xs text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                    />
                    {filterToDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterToDate('');
                          setCurrentPage(1);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title="Clear To Date"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {(filterFromDate || filterToDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterFromDate('');
                        setFilterToDate('');
                        setCurrentPage(1);
                      }}
                      className="text-[11px] text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded-md transition font-medium cursor-pointer"
                    >
                      Clear Date Range
                    </button>
                  )}
                </div>

                {activeFilterCount > 0 && (
                  <div className="flex items-center justify-between pt-2 mt-1">
                    <span className="text-[11px] text-blue-700 font-semibold">
                      {activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'} applied
                      {(filterFromDate || filterToDate) && (
                        <span className="text-slate-500 font-normal ml-1">
                          ({filterFromDate ? formatDateStr(filterFromDate) : 'Start'} → {filterToDate ? formatDateStr(filterToDate) : 'End'})
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setFilterType('ALL');
                        setFilterProduct('ALL');
                        setFilterWarranty('ALL');
                        setFilterBU('ALL');
                        setFilterTAT('ALL');
                        setFilterFromDate('');
                        setFilterToDate('');
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition font-medium cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}
              </div>

              {/* Showing stats & pagination quick controls */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>
                  Showing <strong>{filteredRows.length}</strong> of <strong>{validRows.length}</strong> tasks
                </span>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 font-medium"
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>

            {/* MOBILE & TABLET CARD VIEW (Adaptive Grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop) */}
            <div
              className={`${
                mobileViewMode === 'cards'
                  ? 'block'
                  : mobileViewMode === 'table'
                  ? 'hidden'
                  : 'block lg:hidden'
              } p-2.5 sm:p-4 bg-slate-50/40`}
            >
              {paginatedRows.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
                  <Search className="w-8 h-8 text-slate-300 mx-auto stroke-[1.5] mb-2" />
                  <p className="text-sm font-medium text-slate-600">No service tasks match your criteria</p>
                  <p className="text-xs text-slate-400 mt-1">Try relaxing filters or search keywords</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paginatedRows.map((item) => (
                    <div
                      key={item.index_}
                      className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3 group touch-pan-y"
                    >
                    {/* Header: Task #, Type, Product, TAT */}
                    <div
                      onClick={() => setViewingItem(item)}
                      className="flex items-start justify-between gap-2 cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-blue-700 text-sm">
                            #{item.taskNo || item.slNo}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                              item.type === 'RMR'
                                ? 'bg-violet-100 text-violet-800 border border-violet-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {item.type}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                              item.product === 'GDT'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {item.product}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Date: {formatDateStr(item.taskDate)} • Recv: {formatDateStr(item.receivedOn)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.resolutionDays !== null ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.resolutionDays === 0
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : item.resolutionDays <= 2
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {item.resolutionDays}d TAT
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer & Branch */}
                    <div
                      onClick={() => setViewingItem(item)}
                      className="text-xs cursor-pointer"
                    >
                      <div className="font-semibold text-slate-900 leading-snug">{item.customer}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span className="font-medium text-slate-700">{item.bu}</span>
                        <span className="text-slate-400">• TL: {item.tl}</span>
                        <span className="text-slate-300">•</span>
                        <span
                          className={`text-[10px] font-medium ${
                            item.warranty.toLowerCase().includes('out')
                              ? 'text-rose-600 font-semibold'
                              : item.warranty.toLowerCase().includes('asc')
                              ? 'text-amber-700 font-semibold'
                              : 'text-emerald-700 font-semibold'
                          }`}
                        >
                          {item.warranty}
                        </span>
                      </div>
                    </div>

                    {/* Hardware & Diagnostics Details */}
                    <div
                      onClick={() => setViewingItem(item)}
                      className="p-2.5 bg-slate-50 rounded-lg text-[11px] text-slate-600 space-y-1.5 cursor-pointer hover:bg-slate-100/70 transition"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400 shrink-0">Model:</span>
                        <span className="font-medium text-slate-800 text-right truncate max-w-[200px]">
                          {item.model}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400 shrink-0">RCA Fault:</span>
                        <span className="font-semibold text-slate-800 text-right truncate max-w-[200px]">
                          {item.rca !== '-' ? item.rca : item.problem}
                        </span>
                      </div>
                      {item.actionTaken && item.actionTaken !== '-' && (
                        <div className="flex justify-between gap-2 pt-1 border-t border-slate-200/60">
                          <span className="text-slate-400 shrink-0">Action:</span>
                          <span className="font-medium text-slate-800 text-right truncate max-w-[200px]">
                            {item.actionTaken}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quality & GIR Indicators */}
                    <div className="flex items-center gap-2 flex-wrap text-[10px]">
                      {item.checkListNo && item.checkListNo !== '-' && (
                        <span className="bg-cyan-50 text-cyan-800 border border-cyan-200 px-1.5 py-0.5 rounded font-mono font-semibold flex items-center gap-1">
                          <ClipboardCheck className="w-3 h-3 text-cyan-600" />
                          FCL #{item.checkListNo}
                        </span>
                      )}
                      {item.girNo && item.girNo !== 'NA' && item.girNo !== '-' && (
                        <span className="bg-violet-50 text-violet-800 border border-violet-200 px-1.5 py-0.5 rounded font-mono font-semibold flex items-center gap-1">
                          <PackageCheck className="w-3 h-3 text-violet-600" />
                          GIR #{item.girNo}
                        </span>
                      )}
                    </div>

                    {/* Action Bar with Large Touch-Friendly Targets for Mobile & Tablet */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                      <span className="text-[11px] text-slate-400 font-mono truncate max-w-[100px]" title={item.machineNo}>
                        SN: {item.machineNo !== '-' ? item.machineNo : 'N/A'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setViewingItem(item)}
                          className="min-h-[42px] px-3 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => setEditingItem(item)}
                          className="min-h-[42px] px-3.5 py-2 rounded-lg text-amber-900 bg-amber-50 hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 border border-amber-300/80 transition active:scale-95 cursor-pointer touch-manipulation shadow-2xs"
                          title="Edit Task"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmIndex(item.index_)}
                          className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition active:scale-95 cursor-pointer touch-manipulation"
                          title="Delete Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

            {/* FULL DATA TABLE (Desktop & Tablet landscape view, or when Table view explicitly selected) */}
            <div
              className={`${
                mobileViewMode === 'table'
                  ? 'block'
                  : mobileViewMode === 'cards'
                  ? 'hidden'
                  : 'hidden lg:block'
              } overflow-x-auto min-h-[420px]`}
            >
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10 select-none">
                  <tr>
                    <th
                      onClick={() => handleSort('taskNo')}
                      className="px-3 py-3 cursor-pointer hover:bg-slate-200/70 transition"
                    >
                      <div className="flex items-center gap-1">
                        Task # & Product {sortField === 'taskNo' && (sortDir === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('taskDate')}
                      className="px-3 py-3 cursor-pointer hover:bg-slate-200/70 transition"
                    >
                      <div className="flex items-center gap-1">
                        Dates {sortField === 'taskDate' && (sortDir === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-3 py-3">Type & GIR (RMR)</th>
                    <th
                      onClick={() => handleSort('customer')}
                      className="px-3 py-3 cursor-pointer hover:bg-slate-200/70 transition max-w-[200px]"
                    >
                      <div className="flex items-center gap-1">
                        Customer & Branch {sortField === 'customer' && (sortDir === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-3 py-3">Model / Part</th>
                    <th className="px-3 py-3">Warranty</th>
                    <th
                      onClick={() => handleSort('checkListNo')}
                      className="px-3 py-3 cursor-pointer hover:bg-slate-200/70 transition"
                    >
                      <div className="flex items-center gap-1">
                        Quality Checklist {sortField === 'checkListNo' && (sortDir === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-3 py-3 max-w-[180px]">Observed RCA & Action</th>
                    <th
                      onClick={() => handleSort('resolutionDays')}
                      className="px-3 py-3 text-center cursor-pointer hover:bg-slate-200/70 transition"
                    >
                      <div className="flex items-center justify-center gap-1">
                        TAT {sortField === 'resolutionDays' && (sortDir === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 bg-white">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-16 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Search className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                          <p className="text-sm font-medium text-slate-600">No service tasks match your filters</p>
                          <p className="text-xs text-slate-400">Try adjusting your search criteria or resetting filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((item) => (
                      <tr key={item.index_} className="hover:bg-blue-50/40 transition-colors group">
                        {/* Task No & Product */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-mono font-bold text-blue-700">
                            #{item.taskNo || item.slNo}
                          </div>
                          <div className="mt-0.5">
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                                item.product === 'GDT'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {item.product}
                            </span>
                          </div>
                        </td>

                        {/* Dates: Received & Task Date */}
                        <td className="px-3 py-2.5 whitespace-nowrap text-[11px]">
                          <div className="text-slate-800 font-medium">{formatDateStr(item.taskDate)}</div>
                          <div className="text-slate-400 text-[10px]">Recv: {formatDateStr(item.receivedOn)}</div>
                        </td>

                        {/* Type & GIR for RMR */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                                item.type === 'RMR'
                                  ? 'bg-violet-100 text-violet-800 border border-violet-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {item.type}
                            </span>
                          </div>
                          {item.girNo && item.girNo !== 'NA' && item.girNo !== '-' ? (
                            <div className="mt-1 text-[10px] text-violet-700 font-mono font-semibold" title={`GIR Date: ${formatDateStr(item.girDate)}`}>
                              GIR #{item.girNo}
                              {item.girDate && item.girDate !== '-' && (
                                <span className="text-slate-400 font-normal ml-1">({formatDateStr(item.girDate)})</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 font-mono">GIR: NA</div>
                          )}
                        </td>

                        {/* Customer & Branch */}
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <div className="font-semibold text-slate-900 truncate" title={item.customer}>
                            {item.customer}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            <span className="font-medium text-slate-700">{item.bu}</span>
                            <span className="text-slate-400">• TL: {item.tl}</span>
                          </div>
                        </td>

                        {/* Model & Part */}
                        <td className="px-3 py-2.5 text-[11px] max-w-[170px]">
                          <div className="truncate font-medium text-slate-800" title={item.model}>
                            {item.model}
                          </div>
                          <div className="truncate text-slate-500 text-[10px]" title={item.partName}>
                            {item.partName} {item.capacity !== '-' && `• ${item.capacity}`}
                          </div>
                        </td>

                        {/* Warranty */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.warranty.toLowerCase().includes('out')
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : item.warranty.toLowerCase().includes('asc')
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {item.warranty}
                          </span>
                        </td>

                        {/* Quality Checklist & Date */}
                        <td className="px-3 py-2.5 whitespace-nowrap text-[11px]">
                          {item.checkListNo && item.checkListNo !== '-' ? (
                            <div className="font-mono text-cyan-800 bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1 font-semibold">
                              <ClipboardCheck className="w-3 h-3 text-cyan-600" />
                              FCL #{item.checkListNo}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">FCL: -</span>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.checkDate && item.checkDate !== '-' ? formatDateStr(item.checkDate) : '-'}
                          </div>
                        </td>

                        {/* RCA & Action Taken */}
                        <td className="px-3 py-2.5 text-[11px] max-w-[190px]">
                          <div className="truncate font-medium text-slate-800" title={item.rca !== '-' ? item.rca : item.problem}>
                            {item.rca !== '-' ? item.rca : item.problem}
                          </div>
                          <div className="truncate text-slate-500 text-[10px]" title={item.actionTaken}>
                            {item.actionTaken !== '-' ? item.actionTaken : 'Pending action'}
                          </div>
                        </td>

                        {/* Resolution Days (TAT) */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {item.resolutionDays === null ? (
                            <span className="text-slate-400 text-[11px]">-</span>
                          ) : (
                            <span
                              className={`inline-flex items-center justify-center min-w-[36px] px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                item.resolutionDays === 0
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : item.resolutionDays <= 2
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              {item.resolutionDays}d
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 opacity-90 group-hover:opacity-100">
                            <button
                              onClick={() => setViewingItem(item)}
                              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                              title="Inspect Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingItem(item)}
                              className="p-1 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                              title="Edit Record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmIndex(item.index_)}
                              className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (
                {sortedRows.length} records filtered)
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-semibold text-slate-800 bg-slate-100 rounded border border-slate-200">
                  {currentPage}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRODUCT LINES & QUALITY RCA */}
        {activeTab === 'rca' && (
          <div className="space-y-6">
            {/* Product Category & Quality Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Product Classification
                  </span>
                  <Tag className="w-4 h-4 text-blue-600" />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700">EWS (Electronic Weighing)</span>
                    <span className="font-bold text-blue-700 text-sm">{stats.productCounts['EWS'] || 0} tasks</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full"
                      style={{
                        width: `${Math.round(((stats.productCounts['EWS'] || 0) / (stats.total || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="font-semibold text-slate-700">GDT (GPS Clocks & Timers)</span>
                    <span className="font-bold text-amber-700 text-sm">{stats.productCounts['GDT'] || 0} tasks</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{
                        width: `${Math.max(4, Math.round(((stats.productCounts['GDT'] || 0) / (stats.total || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    RMR & GIR Inward Tracking
                  </span>
                  <PackageCheck className="w-4 h-4 text-violet-600" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-violet-700">{stats.girTrackedCount}</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Returned Material Repair units verified with logged <strong>GIR No. & GIR Date</strong>
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span>Total RMR Requests:</span>
                    <strong className="text-violet-800">{stats.rmrCount}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Functional Inspection
                  </span>
                  <FileCheck className="w-4 h-4 text-cyan-600" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-cyan-700">{stats.fclCheckedCount}</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Post-repair units registered with verified <strong>Functional Check List No. & Date</strong>
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span>Quality Check Coverage:</span>
                    <strong className="text-cyan-800">
                      {stats.total ? ((stats.fclCheckedCount / stats.total) * 100).toFixed(0) : 0}%
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Common Replacement Parts & Series */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-600" />
                    Most Replaced Component Assemblies
                  </h3>
                  <p className="text-xs text-slate-500">
                    Highest turnover parts requested across all regional branches
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {topPartsData.map((item, idx) => {
                    const maxVal = topPartsData[0]?.count || 1;
                    const pct = Math.round((item.count / maxVal) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-800">{item.part}</span>
                          <span className="font-bold text-slate-700">{item.count} units</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    Product Series Distribution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Repair ticket count categorized by weighing scale and clock model series
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {modelBreakdown.map((item, idx) => {
                    const maxVal = modelBreakdown[0]?.count || 1;
                    const pct = Math.round((item.count / maxVal) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-800">{item.model}</span>
                          <span className="text-slate-500 font-semibold">{item.count} tickets</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Diagnostic Log Table including Product, GIR, FCL */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-600" />
                CSC Diagnostic Log with Quality & GIR Tracking Details
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Inspection records displaying Product Line, Quality Checklist No/Date, and RMR Inward GIR references
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Task #</th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3">Quality Checklist</th>
                      <th className="py-2.5 px-3">GIR Ref (RMR)</th>
                      <th className="py-2.5 px-3">CSC RCA Observation</th>
                      <th className="py-2.5 px-3">Action Taken</th>
                      <th className="py-2.5 px-3">Spare Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validRows
                      .filter((r) => r.sparePartCode && r.sparePartCode !== '-')
                      .slice(0, 10)
                      .map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-mono font-semibold text-blue-700">#{r.taskNo}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 font-bold text-slate-700">
                              {r.product}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{r.model}</td>
                          <td className="py-2.5 px-3 text-[11px]">
                            {r.checkListNo && r.checkListNo !== '-' ? (
                              <span className="font-mono text-cyan-800 font-semibold">FCL #{r.checkListNo} ({formatDateStr(r.checkDate)})</span>
                            ) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[11px]">
                            {r.girNo && r.girNo !== 'NA' && r.girNo !== '-' ? (
                              <span className="font-mono text-violet-700 font-semibold">GIR #{r.girNo}</span>
                            ) : <span className="text-slate-400">NA</span>}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">{r.rca}</td>
                          <td className="py-2.5 px-3 text-slate-800 truncate max-w-[200px]">{r.actionTaken}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] bg-slate-50 text-slate-700 font-semibold rounded">
                            {r.sparePartCode}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BRANCH BENCHMARKS */}
        {activeTab === 'branches' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Service Unit & Branch Performance Scorecard
                  </h3>
                  <p className="text-xs text-slate-500">
                    Operational efficiency benchmarks across all regional service branches
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  Total Active Branches: <strong>{buPerformance.length}</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                {buPerformance.map((branch, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-xs transition bg-slate-50/30 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          {branch.bu}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            branch.avgTat <= 1
                              ? 'bg-emerald-100 text-emerald-800'
                              : branch.avgTat <= 2.5
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {branch.avgTat}d TAT
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-4 text-center bg-white p-2.5 rounded-lg border border-slate-100">
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Total</div>
                          <div className="text-base font-bold text-slate-900">{branch.total}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-blue-500 font-medium">SPRR</div>
                          <div className="text-base font-bold text-blue-600">{branch.sprr}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-violet-500 font-medium">RMR</div>
                          <div className="text-base font-bold text-violet-600">{branch.rmr}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Service Speed:</span>
                      <span className="font-medium text-slate-800">
                        {branch.avgTat === 0 ? 'Instant (Same-day)' : `${branch.avgTat} days turnaround`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Navigation & Edit Bar for Mobile & Tablet (Hidden during active modals) */}
      {!viewingItem && !editingItem && !isAddModalOpen && deleteConfirmIndex === null && (
        <div className="fixed bottom-2.5 inset-x-2.5 sm:inset-x-6 z-30 lg:hidden pointer-events-none pb-[env(safe-area-inset-bottom,0px)]">
          <div className="max-w-xl mx-auto bg-slate-950/90 backdrop-blur-lg text-white p-1.5 rounded-2xl shadow-2xl border border-slate-800/80 flex items-center justify-between pointer-events-auto gap-1">
            <div className="flex items-center gap-0.5 sm:gap-1 flex-1 min-w-0">
              <button
                onClick={() => setActiveTab('overview')}
                className={`min-h-[42px] px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition touch-manipulation ${
                  activeTab === 'overview' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span className="text-[11px] hidden xs:inline">Stats</span>
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                className={`min-h-[42px] px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition touch-manipulation ${
                  activeTab === 'tasks' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="text-[11px]">Tasks</span>
              </button>
              {activeTab === 'tasks' && (
                <button
                  onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                  className={`min-h-[42px] px-2 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 relative transition touch-manipulation ${
                    isMobileFilterOpen || activeFilterCount > 0
                      ? 'bg-blue-500/30 text-blue-300 font-bold'
                      : 'text-slate-300 hover:bg-slate-800/80'
                  }`}
                  title="Filter Tasks"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setActiveTab('rca')}
                className={`min-h-[42px] px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition touch-manipulation ${
                  activeTab === 'rca' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <Cpu className="w-4 h-4 shrink-0" />
                <span className="text-[11px] hidden xs:inline">RCA</span>
              </button>
              <button
                onClick={() => setActiveTab('branches')}
                className={`min-h-[42px] px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition touch-manipulation ${
                  activeTab === 'branches' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="text-[11px] hidden sm:inline">Branches</span>
              </button>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="min-h-[42px] flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-600/40 active:scale-95 transition cursor-pointer touch-manipulation shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL - RESPONSIVE TOUCH DRAWER ON MOBILE, CLEAN DIALOG ON TABLET/DESKTOP */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl animate-scale-up overflow-hidden">
            {/* Mobile Touch Drag Indicator Bar */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 shrink-0" />

            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between shrink-0 bg-white gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      viewingItem.type === 'RMR'
                        ? 'bg-violet-100 text-violet-800 border border-violet-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {viewingItem.type}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    Product: {viewingItem.product}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">Task #{viewingItem.taskNo}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate">
                  Received: {formatDateStr(viewingItem.receivedOn)} • Registered: {formatDateStr(viewingItem.taskDate)}
                </p>
              </div>

              {/* Header Quick Edit button on Mobile and Tab */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setEditingItem(viewingItem);
                    setViewingItem(null);
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation"
                  title="Switch to Edit Form"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setViewingItem(null)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer touch-manipulation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 touch-pan-y">
              {/* General Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block mb-0.5">Customer / Reseller</span>
                  <strong className="text-slate-900 block break-words text-sm sm:text-xs">{viewingItem.customer}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Branch (BU)</span>
                  <strong className="text-slate-900 block text-sm sm:text-xs">{viewingItem.bu}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Warranty Status</span>
                  <strong className="text-slate-900 block text-sm sm:text-xs">{viewingItem.warranty}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Product Line</span>
                  <strong className="text-blue-700 block font-bold text-sm sm:text-xs">{viewingItem.product}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Model & Capacity</span>
                  <strong className="text-slate-900 block truncate">{viewingItem.model} ({viewingItem.capacity})</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Machine Serial No</span>
                  <strong className="text-slate-900 block font-mono text-sm sm:text-xs truncate">{viewingItem.machineNo}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Part Name</span>
                  <strong className="text-slate-900 block truncate">{viewingItem.partName}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Team Lead</span>
                  <strong className="text-slate-900 block">{viewingItem.tl}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Resolution TAT</span>
                  <strong className="text-blue-700 block font-bold text-sm sm:text-xs">
                    {viewingItem.resolutionDays !== null ? `${viewingItem.resolutionDays} days` : 'Pending'}
                  </strong>
                </div>
              </div>

              {/* Specialized Logistics & Quality Sections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Quality Functional Checklist Card */}
                <div className="p-3.5 bg-cyan-50/70 rounded-xl border border-cyan-200">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-900 mb-2">
                    <ClipboardCheck className="w-4 h-4 text-cyan-700" />
                    Quality Functional Inspection
                  </div>
                  <div className="space-y-1 text-slate-700">
                    <div>Checklist No: <strong className="font-mono text-cyan-900">{viewingItem.checkListNo}</strong></div>
                    <div>Inspection Date: <strong>{formatDateStr(viewingItem.checkDate)}</strong></div>
                  </div>
                </div>

                {/* RMR GIR Logistics Card */}
                <div className="p-3.5 bg-violet-50/70 rounded-xl border border-violet-200">
                  <div className="flex items-center gap-1.5 font-bold text-violet-900 mb-2">
                    <PackageCheck className="w-4 h-4 text-violet-700" />
                    RMR Inward & GIR Logistics
                  </div>
                  <div className="space-y-1 text-slate-700">
                    <div>GIR No for RMR: <strong className="font-mono text-violet-900">{viewingItem.girNo}</strong></div>
                    <div>GIR Date: <strong>{formatDateStr(viewingItem.girDate)}</strong></div>
                  </div>
                </div>
              </div>

              {/* Diagnostic and Action Sections */}
              <div className="space-y-3 pt-1 text-xs">
                <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100">
                  <span className="font-semibold text-blue-900 block mb-1">Reported Problem Description:</span>
                  <p className="text-slate-700 leading-relaxed">{viewingItem.problem || 'No problem description specified'}</p>
                </div>

                <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
                  <span className="font-semibold text-amber-900 block mb-1">CSC RCA Observation:</span>
                  <p className="text-slate-700 leading-relaxed">{viewingItem.rca || 'Under CSC observation'}</p>
                </div>

                <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <span className="font-semibold text-emerald-900 block mb-1">Action Taken & Components Replaced:</span>
                  <p className="text-slate-700 leading-relaxed">{viewingItem.actionTaken || 'None specified'}</p>
                  {viewingItem.sparePartCode && viewingItem.sparePartCode !== '-' && (
                    <span className="inline-block mt-2 font-mono text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                      Spare Code: {viewingItem.sparePartCode}
                    </span>
                  )}
                </div>

                {viewingItem.remarks && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-semibold text-slate-800 block mb-1">Internal Remarks:</span>
                    <p className="text-slate-600">{viewingItem.remarks}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Touch-Friendly Footer with Safe Area Support */}
            <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 bg-slate-50/95">
              <button
                onClick={() => setViewingItem(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition cursor-pointer active:scale-95 touch-manipulation"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setEditingItem(viewingItem);
                  setViewingItem(null);
                }}
                className="min-h-[44px] px-6 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-md shadow-blue-600/30 cursor-pointer flex items-center gap-1.5 active:scale-95 touch-manipulation"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit This Task</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <TaskFormModal
          title={`Edit Task #${editingItem.taskNo}`}
          initialValues={editingItem}
          buOptions={buList}
          productList={productList}
          onClose={() => setEditingItem(null)}
          onSubmit={handleUpdateItemSubmit}
        />
      )}

      {/* ADD NEW TASK MODAL */}
      {isAddModalOpen && (
        <TaskFormModal
          title="Register New CSC Service Task"
          buOptions={buList}
          productList={productList}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleCreateItemSubmit}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-full">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Delete Task Record</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete this repair task from the sheet? This change persists immediately.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmIndex(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteItem(deleteConfirmIndex)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Task Form Modal (Add / Edit) with Touch Chips & Mobile/Tablet Layout
function TaskFormModal({ title, initialValues = {}, buOptions = [], productList = [], onClose, onSubmit }) {
  const [formSection, setFormSection] = useState('all'); // 'all' | 'basic' | 'hardware' | 'diagnostics' | 'quality'
  const [formData, setFormData] = useState({
    type: initialValues.type || 'SPRR',
    receivedOn: initialValues.receivedOn || new Date().toISOString().split('T')[0],
    taskNo: initialValues.taskNo || '',
    taskDate: initialValues.taskDate || new Date().toISOString().split('T')[0],
    customer: initialValues.customer || '',
    bu: initialValues.bu || (buOptions[0] || 'Pune'),
    tl: initialValues.tl || 'AKB',
    product: initialValues.product || 'EWS',
    model: initialValues.model || 'DX / DF / DS Series',
    machineNo: initialValues.machineNo || '',
    capacity: initialValues.capacity || '30KG',
    partName: initialValues.partName || 'WS-MAIN BOARD',
    warranty: initialValues.warranty || 'Warranty',
    problem: initialValues.problem || '',
    rca: initialValues.rca || '',
    actionTaken: initialValues.actionTaken || '',
    sparePartCode: initialValues.sparePartCode || '',
    checkListNo: initialValues.checkListNo || '',
    checkDate: initialValues.checkDate || new Date().toISOString().split('T')[0],
    girNo: initialValues.girNo || '',
    girDate: initialValues.girDate || '',
    completed: initialValues.completed || new Date().toISOString().split('T')[0],
    resolutionDays: initialValues.resolutionDays !== undefined && initialValues.resolutionDays !== null ? initialValues.resolutionDays : 1,
    remarks: initialValues.remarks || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleChipSelect = (name, val) => {
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleSetToday = (fieldName) => {
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, [fieldName]: today }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const showBasic = formSection === 'all' || formSection === 'basic';
  const showHardware = formSection === 'all' || formSection === 'hardware';
  const showDiagnostics = formSection === 'all' || formSection === 'diagnostics';
  const showQuality = formSection === 'all' || formSection === 'quality';

  // Common quick-fill suggestions for technicians on tablets & phones
  const commonRCAs = [
    'No Display',
    'Variation',
    'No Sensing',
    'Low Battery issue',
    'Track Burn\'t',
    'Battery not charging',
    'Keys are not working',
    'No Output',
    'WORKING FINE'
  ];

  const commonActions = [
    'Replaced controller ic',
    'Replaced adc ic',
    'Replaced regulator',
    'Replaced Battery',
    'Replaced smps',
    'RE-assemble full machine',
    'Replaced communication ic',
    'RMR'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-3xl w-full h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
        {/* Mobile drag handle indicator */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 shrink-0" />

        {/* Sticky Modal Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white gap-2">
          <div className="flex items-center gap-2 truncate">
            <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">{title}</h3>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate hidden xs:block">
                Mobile & Tablet optimized live editor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Quick Jump Bar for Mobile & Tablet */}
        <div className="flex items-center space-x-1 px-3 py-2 bg-slate-50 border-b border-slate-100 overflow-x-auto scrollbar-none shrink-0 touch-pan-x">
          <button
            type="button"
            onClick={() => setFormSection('all')}
            className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg transition whitespace-nowrap touch-manipulation ${
              formSection === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 bg-white border border-slate-200'
            }`}
          >
            All Fields
          </button>
          <button
            type="button"
            onClick={() => setFormSection('basic')}
            className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg transition whitespace-nowrap touch-manipulation ${
              formSection === 'basic' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 bg-white border border-slate-200'
            }`}
          >
            Basic Info
          </button>
          <button
            type="button"
            onClick={() => setFormSection('hardware')}
            className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg transition whitespace-nowrap touch-manipulation ${
              formSection === 'hardware' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 bg-white border border-slate-200'
            }`}
          >
            Machine & Part
          </button>
          <button
            type="button"
            onClick={() => setFormSection('diagnostics')}
            className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg transition whitespace-nowrap touch-manipulation ${
              formSection === 'diagnostics' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 bg-white border border-slate-200'
            }`}
          >
            RCA & Actions
          </button>
          <button
            type="button"
            onClick={() => setFormSection('quality')}
            className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg transition whitespace-nowrap touch-manipulation ${
              formSection === 'quality' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 bg-white border border-slate-200'
            }`}
          >
            Quality & GIR
          </button>
        </div>

        {/* Scrollable Form Body with text-base on mobile to prevent iOS Safari auto-zoom */}
        <form id="task-edit-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 touch-pan-y">
          {/* Section 1: Basic Info & Identification */}
          {showBasic && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                  Basic Registration & Customer
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Section 1</span>
              </div>

              {/* Quick Type & Product Touch Selectors */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Ticket Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleChipSelect('type', 'SPRR')}
                      className={`min-h-[38px] rounded-xl text-xs font-bold border transition touch-manipulation ${
                        formData.type === 'SPRR'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      SPRR
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChipSelect('type', 'RMR')}
                      className={`min-h-[38px] rounded-xl text-xs font-bold border transition touch-manipulation ${
                        formData.type === 'RMR'
                          ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      RMR
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Product</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleChipSelect('product', 'EWS')}
                      className={`min-h-[38px] rounded-xl text-xs font-bold border transition touch-manipulation ${
                        formData.product === 'EWS'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      EWS
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChipSelect('product', 'GDT')}
                      className={`min-h-[38px] rounded-xl text-xs font-bold border transition touch-manipulation ${
                        formData.product === 'GDT'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      GDT
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Task No. *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="taskNo"
                    required
                    value={formData.taskNo}
                    onChange={handleChange}
                    placeholder="e.g. 845012"
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700">Task Date</label>
                    <button
                      type="button"
                      onClick={() => handleSetToday('taskDate')}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      Today
                    </button>
                  </div>
                  <input
                    type="date"
                    name="taskDate"
                    value={formData.taskDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Branch / BU Name</label>
                  <input
                    type="text"
                    name="bu"
                    value={formData.bu}
                    onChange={handleChange}
                    placeholder="e.g. Pune, Chennai"
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700">Received On</label>
                    <button
                      type="button"
                      onClick={() => handleSetToday('receivedOn')}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      Today
                    </button>
                  </div>
                  <input
                    type="date"
                    name="receivedOn"
                    value={formData.receivedOn}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Reseller Name *</label>
                <input
                  type="text"
                  name="customer"
                  required
                  value={formData.customer}
                  onChange={handleChange}
                  placeholder="Customer or Firm Name"
                  className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Section 2: Machine Specs, Serial & Part */}
          {showHardware && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-blue-600" />
                  Machine Specifications & Warranty
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Section 2</span>
              </div>

              {/* Quick Warranty Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Warranty Status</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['Warranty', 'ASC', 'Out of Warranty'].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => handleChipSelect('warranty', w)}
                      className={`min-h-[38px] px-2 py-1 rounded-xl text-xs font-bold border transition touch-manipulation truncate ${
                        formData.warranty.toLowerCase() === w.toLowerCase()
                          ? w === 'Warranty'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : w === 'ASC'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model Series</label>
                  <input
                    type="text"
                    name="model"
                    value={formData.model}
                    onChange={handleChange}
                    placeholder="e.g. DX / DF / DS Series"
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Machine Serial Number</label>
                  <input
                    type="text"
                    name="machineNo"
                    value={formData.machineNo}
                    onChange={handleChange}
                    placeholder="Serial No / SN"
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Capacity</label>
                  <input
                    type="text"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleChange}
                    placeholder="e.g. 30KG, 600G"
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Part Name</label>
                  <input
                    type="text"
                    name="partName"
                    value={formData.partName}
                    onChange={handleChange}
                    placeholder="e.g. WS-MAIN BOARD"
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Team Lead (TL)</label>
                  <input
                    type="text"
                    name="tl"
                    value={formData.tl}
                    onChange={handleChange}
                    placeholder="e.g. AKB, YKR"
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Technical Diagnostics, RCA & Action Taken */}
          {showDiagnostics && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-600" />
                  Technical Diagnostics, RCA & Action
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Section 3</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reported Problem Description</label>
                <input
                  type="text"
                  name="problem"
                  value={formData.problem}
                  onChange={handleChange}
                  placeholder="Problem reported by customer"
                  className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* RCA Field + Quick Tap Suggestion Pills for Mobile */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  CSC Observation / RCA Root Cause
                </label>
                <input
                  type="text"
                  name="rca"
                  value={formData.rca}
                  onChange={handleChange}
                  placeholder="Root cause or defect identified"
                  className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none touch-pan-x">
                  <span className="text-[10px] text-slate-400 font-semibold shrink-0">Quick RCA:</span>
                  {commonRCAs.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleChipSelect('rca', tag)}
                      className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition shrink-0 touch-manipulation ${
                        formData.rca === tag
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Taken Field + Quick Action Suggestion Pills */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Spare Replaced / Action Taken
                </label>
                <input
                  type="text"
                  name="actionTaken"
                  value={formData.actionTaken}
                  onChange={handleChange}
                  placeholder="Action taken or components repaired"
                  className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none touch-pan-x">
                  <span className="text-[10px] text-slate-400 font-semibold shrink-0">Quick Action:</span>
                  {commonActions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleChipSelect('actionTaken', tag)}
                      className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition shrink-0 touch-manipulation ${
                        formData.actionTaken === tag
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Turnaround Time (TAT) & Spare Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Spare Part Code(s)</label>
                  <input
                    type="text"
                    name="sparePartCode"
                    value={formData.sparePartCode}
                    onChange={handleChange}
                    placeholder="e.g. 26305, 14713"
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution TAT (Days)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      name="resolutionDays"
                      min="0"
                      step="1"
                      value={formData.resolutionDays}
                      onChange={handleChange}
                      className="w-20 px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs font-bold text-center focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-none">
                      {[0, 1, 2, 3].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleChipSelect('resolutionDays', d)}
                          className={`flex-1 min-h-[38px] px-1.5 rounded-xl text-xs font-bold border transition touch-manipulation ${
                            formData.resolutionDays === d
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700">Completed Date</label>
                    <button
                      type="button"
                      onClick={() => handleSetToday('completed')}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      Today
                    </button>
                  </div>
                  <input
                    type="date"
                    name="completed"
                    value={formData.completed}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Quality Checklist, GIR Logistics & Remarks */}
          {showQuality && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-cyan-600" />
                  Quality Inspection & GIR Logistics
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Section 4</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold text-cyan-950 mb-1">Functional Check List #</label>
                  <input
                    type="text"
                    name="checkListNo"
                    value={formData.checkListNo}
                    onChange={handleChange}
                    placeholder="e.g. 14.0"
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-cyan-950 mb-1">Functional Check Date</label>
                  <input
                    type="date"
                    name="checkDate"
                    value={formData.checkDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-violet-950 mb-1">GIR No. for RMR</label>
                  <input
                    type="text"
                    name="girNo"
                    value={formData.girNo}
                    onChange={handleChange}
                    placeholder="e.g. 129932"
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs font-mono focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-violet-950 mb-1">GIR Date</label>
                  <input
                    type="date"
                    name="girDate"
                    value={formData.girDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks & Field Notes</label>
                <textarea
                  name="remarks"
                  rows={2}
                  value={formData.remarks}
                  onChange={handleChange}
                  placeholder="Internal remarks or tracking notes..."
                  className="w-full px-3 py-2.5 sm:py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}
        </form>

        {/* Sticky Touch-Optimized Submit Bar with Safe-Area Support */}
        <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 bg-slate-50/95">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition cursor-pointer active:scale-95 touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="task-edit-form"
            className="min-h-[44px] px-6 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-md shadow-blue-600/30 cursor-pointer active:scale-95 touch-manipulation"
          >
            Save Record
          </button>
        </div>
      </div>
    </div>
  );
}

// Visual Chart Component: Monthly Timeline Stacked Bar Chart with D3
function TimelineBarChart({ data }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 220 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;
  const isSmallScreen = width < 450;
  const margin = {
    top: 20,
    right: isSmallScreen ? 8 : 20,
    bottom: isSmallScreen ? 25 : 30,
    left: isSmallScreen ? 28 : 38
  };
  const innerWidth = Math.max(50, width - margin.left - margin.right);
  const innerHeight = Math.max(50, height - margin.top - margin.bottom);

  const cleanData = data.filter((d) => d.month !== 'Other');

  const xScale = useMemo(() => {
    return d3
      .scaleBand()
      .domain(cleanData.map((d) => d.month))
      .range([0, innerWidth])
      .padding(0.35);
  }, [cleanData, innerWidth]);

  const maxVal = useMemo(() => {
    return d3.max(cleanData, (d) => d.total) || 10;
  }, [cleanData]);

  const yScale = useMemo(() => {
    return d3.scaleLinear().domain([0, maxVal * 1.15]).range([innerHeight, 0]);
  }, [maxVal, innerHeight]);

  const yTicks = yScale.ticks(4);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg width={width} height={height} className="overflow-visible">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yTicks.map((t, idx) => (
            <g key={idx} transform={`translate(0, ${yScale(t)})`}>
              <line x1={0} x2={innerWidth} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={-8} y={3} textAnchor="end" className="fill-slate-400 text-[10px]">
                {t}
              </text>
            </g>
          ))}

          {cleanData.map((d) => {
            const x = xScale(d.month) || 0;
            const barW = xScale.bandwidth();
            const sprrH = innerHeight - yScale(d.sprr);
            const rmrH = innerHeight - yScale(d.rmr);

            return (
              <g key={d.month} className="cursor-pointer group">
                {/* SPRR segment */}
                <rect
                  x={x}
                  y={yScale(d.sprr)}
                  width={barW}
                  height={sprrH}
                  rx={2}
                  className="fill-blue-500 hover:fill-blue-600 transition-colors"
                />

                {/* RMR segment */}
                <rect
                  x={x}
                  y={yScale(d.total)}
                  width={barW}
                  height={rmrH}
                  rx={2}
                  className="fill-violet-500 hover:fill-violet-600 transition-colors"
                />

                <text
                  x={x + barW / 2}
                  y={yScale(d.total) - 6}
                  textAnchor="middle"
                  className="fill-slate-700 text-[10px] font-bold"
                >
                  {d.total}
                </text>

                <text
                  x={x + barW / 2}
                  y={innerHeight + 18}
                  textAnchor="middle"
                  className="fill-slate-500 text-[9px] sm:text-[10px] font-medium"
                >
                  {isSmallScreen ? d.month.split(' ')[0] : d.month}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

// Donut Chart for Warranty Breakdown
function WarrantyDonutChart({ warrantyCount, ascCount, outCount }) {
  const total = warrantyCount + ascCount + outCount;
  if (total === 0) return <div className="text-xs text-slate-400">No records</div>;

  const radius = 64;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;

  const wPct = warrantyCount / total;
  const aPct = ascCount / total;
  const oPct = outCount / total;

  const wOffset = 0;
  const aOffset = -(wPct * circumference);
  const oOffset = -((wPct + aPct) * circumference);

  return (
    <div className="relative flex items-center justify-center">
      <svg width={160} height={160} className="rotate-[-90deg]">
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth={strokeWidth}
          strokeDasharray={`${wPct * circumference} ${circumference}`}
          strokeDashoffset={wOffset}
        />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={strokeWidth}
          strokeDasharray={`${aPct * circumference} ${circumference}`}
          strokeDashoffset={aOffset}
        />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#f43f5e"
          strokeWidth={strokeWidth}
          strokeDasharray={`${oPct * circumference} ${circumference}`}
          strokeDashoffset={oOffset}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-extrabold text-slate-900">{total}</span>
        <span className="text-[10px] text-slate-500 font-medium">Claims</span>
      </div>
    </div>
  );
}

export default App;