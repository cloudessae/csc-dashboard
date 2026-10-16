import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Wrench, Layers, CheckSquare, RefreshCw, Sun, Moon, Search,
  CheckCircle2, Clock, Plus, Edit2, Trash2, X, Database,
  Package, IndianRupee, Eye, AlertCircle, Percent,
  RotateCcw, Tag, DownloadCloud, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, Check, SlidersHorizontal, Menu, Sparkles
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                CONFIGURATION                               */
/* -------------------------------------------------------------------------- */
const SPREADSHEET_ID = "1pFP8C3cz26s4ZBXkwptMIZsl-3qkQz-Xs5pQfMMnuJc";

const APPROVAL_COLUMN_HEADERS = [
  'Req ID', 'Req Date', 'Order Number', 'Requester Comment', 'BU Name',
  'Task Owner', 'Part Code', 'Part Decription', 'Quanitity', 'Price',
  'Task No.', 'Ordered By', 'Part Transaction', 'Transaction Type',
  'Tax Category', 'Approval Status', 'Status', 'Status Date', 'Remarks'
];

const PRESET_BU_LIST = [
  'Ahmedabad', 'Baroda', 'Indore', 'Goa', 'Hubli', 'Mangalore', 'Mysore', 'BSC',
  'Chennai', 'Coimbatore', 'NCR', 'Pondicherry', 'Cochin', 'Tirupati', 'Dindigul',
  'Erode', 'Madurai', 'Salem', 'Tirunelveli', 'Mohali', 'Haridwar', 'Jaipur',
  'Lucknow', 'Hosur', 'Bhubaneshwar', 'Kolkata', 'Mumbai', 'Nagpur', 'Nasik',
  'Pune', 'Vijayawada', 'Vizag', 'Hyderabad'
];

const PRESET_BU_TO_TL = {
  Ahmedabad: 'AKB', Baroda: 'AKB', Indore: 'AKB', Goa: 'AKB', Hubli: 'AKB',
  Mangalore: 'AKB', Mysore: 'AKB', BSC: 'AKB', Chennai: 'YKR', Coimbatore: 'YKR',
  NCR: 'AKB', Pondicherry: 'YKR', Cochin: 'YKR', Tirupati: 'YKR', Dindigul: 'YKR',
  Erode: 'YKR', Madurai: 'YKR', Salem: 'YKR', Tirunelveli: 'YKR', Mohali: 'AKB',
  Haridwar: 'AKB', Jaipur: 'AKB', Lucknow: 'AKB', Hosur: 'YKR', Bhubaneshwar: 'YKR',
  Kolkata: 'YKR', Mumbai: 'AKB', Nagpur: 'AKB', Nasik: 'AKB', Pune: 'AKB',
  Vijayawada: 'YKR', Vizag: 'YKR', Hyderabad: 'YKR'
};

const PRESET_ORDERED_BY = ['CSC', 'BU'];
const PRESET_PART_TRANSACTIONS = ['RMR', 'ICSL', 'ST', 'PBS', 'CSC Warranty'];
const PRESET_TRANSACTION_TYPES = [
  'BOM_BU_Transfer_Permanent_Ord', 'BOM_BU_DC_Permanent_Ord',
  'BOM_Branch_Stock_Transf_Order', 'BOM_DC_Stock_Transf_Order',
  'BOM_FOC_Local_Warranty', 'BOM_FOC_Interstate_Warranty'
];
const TRANSACTION_TYPE_TO_TAX = {
  BOM_BU_Transfer_Permanent_Ord: 'Bom:Insterstate 18%',
  BOM_BU_DC_Permanent_Ord: 'Bom:Local 0%',
  BOM_Branch_Stock_Transf_Order: 'Bom:Interstate 18%',
  BOM_DC_Stock_Transf_Order: 'Bom:Local 0%',
  BOM_FOC_Local_Warranty: 'Bom:Local 0%',
  BOM_FOC_Interstate_Warranty: 'Bom:Interstate 0%'
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#2dd4bf', '#fb923c', '#818cf8'];

/* -------------------------------------------------------------------------- */
/*                            INDEXED-DB STORAGE ENGINE                       */
/* -------------------------------------------------------------------------- */
const DB_NAME = 'CSCDashboardDB';
const DB_VERSION = 1;
const STORE_NAME = 'sheet_cache';

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function setDbItem(key, value) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB setItem error:', err);
  }
}

async function getDbItem(key) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB getItem error:', err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*             STRICT DATE NORMALIZER & FORMATTER (DD-MMM-YYYY)               */
/* -------------------------------------------------------------------------- */
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  if (typeof val === 'number' && val > 20000 && val < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + val * 86400000);
  }

  const strVal = String(val).trim();
  const gvizMatch = strVal.match(/Date\((\d+),(\d+),(\d+)/);
  if (gvizMatch) {
    return new Date(parseInt(gvizMatch[1], 10), parseInt(gvizMatch[2], 10), parseInt(gvizMatch[3], 10));
  }

  const cleaned = strVal.split(' ')[0];
  const dashMatch = cleaned.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})$/);
  if (dashMatch) {
    const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    const day = parseInt(dashMatch[1], 10);
    const month = months[dashMatch[2].toLowerCase()];
    let year = parseInt(dashMatch[3], 10);
    if (year < 100) year += 2000;
    if (month !== undefined) return new Date(year, month, day);
  }

  const isoMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }

  const ddmmyyyyMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (ddmmyyyyMatch) {
    let year = parseInt(ddmmyyyyMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, parseInt(ddmmyyyyMatch[2], 10) - 1, parseInt(ddmmyyyyMatch[1], 10));
  }

  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(val) {
  if (!val || val === '-' || val === 'N/A' || val === 'null' || val === 'undefined') return '-';
  const d = val instanceof Date ? val : parseDate(val);
  if (!d || isNaN(d.getTime())) {
    return typeof val === 'string' && val.trim() ? val.trim() : '-';
  }
  return `${String(d.getDate()).padStart(2, '0')}-${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
}

function toISODateInput(dateStrOrObj) {
  if (!dateStrOrObj) return '';
  const d = typeof dateStrOrObj === 'string' ? parseDate(dateStrOrObj) : dateStrOrObj;
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseCurrency(val) {
  if (!val) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

function parseCategoryValue(val) {
  if (!val) return 'NA';
  const clean = String(val).trim().toUpperCase();
  if (clean.startsWith('WA')) return 'Warranty';
  if (clean.startsWith('AMC')) return 'ASC';
  return 'NA';
}

/* -------------------------------------------------------------------------- */
/*             ROBUST CSV FETCH ENGINE (NO NULLIFIED ALPHANUMERIC CELLS)      */
/* -------------------------------------------------------------------------- */
async function fetchGoogleSheetData(sheetName) {
  const encodedSheet = encodeURIComponent(sheetName);
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet "${sheetName}". Ensure the sheet is public.`);
  }
  const csvText = await response.text();

  const parseCSV = (text) => {
    const lines = [];
    let row = [];
    let entry = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          entry += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(entry.trim());
        entry = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        row.push(entry.trim());
        if (row.some(cell => cell !== '')) lines.push(row);
        row = [];
        entry = '';
      } else {
        entry += char;
      }
    }
    if (entry || row.length > 0) {
      row.push(entry.trim());
      if (row.some(cell => cell !== '')) lines.push(row);
    }
    return lines;
  };

  const parsed = parseCSV(csvText);
  if (!parsed || parsed.length === 0) {
    return { cols: [], rows: [] };
  }

  const rawHeaders = parsed[0];
  const cols = rawHeaders.map((h, i) => (h && h.trim()) ? h.trim() : `Col_${i}`);

  const rows = parsed.slice(1).map(dataRow => {
    const rowObj = {};
    const rawArray = [];
    cols.forEach((colName, idx) => {
      const val = dataRow[idx] !== undefined && dataRow[idx] !== null ? String(dataRow[idx]).trim() : '';
      rowObj[colName] = val;
      rawArray[idx] = val;
    });
    rowObj.__raw = rawArray;
    return rowObj;
  });

  return { cols, rows };
}

/* -------------------------------------------------------------------------- */
/*               REUSABLE ACCESSIBLE MULTI-SELECT DROPDOWN                    */
/* -------------------------------------------------------------------------- */
function MultiSelectDropdown({ label, options = [], selected = [], onChange, isDark, placeholder = "All" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(item => item !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const selectAll = () => onChange([...options]);
  const clearAll = () => onChange([]);

  const filteredOptions = useMemo(() => {
    if (!filterQuery.trim()) return options;
    const q = filterQuery.toLowerCase();
    return options.filter(o => String(o).toLowerCase().includes(q));
  }, [options, filterQuery]);

  const buttonText = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) return selected[0];
    return `${label ? label + ': ' : ''}(${selected.length})`;
  }, [selected, placeholder, label]);

  return (
    <div className={`relative w-full ${isOpen ? 'z-[110]' : 'z-20'}`} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 truncate tracking-wide">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full min-h-[42px] text-xs px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-1.5 text-left font-medium transition-all duration-200 cursor-pointer active:scale-[0.99] backdrop-blur-md ${
          selected.length > 0
            ? 'border-indigo-500/70 bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/10 text-indigo-700 dark:text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/30'
            : isDark
              ? 'bg-slate-900/80 border-white/10 text-slate-200 hover:border-white/20 hover:bg-slate-800/80 shadow-inner'
              : 'bg-white/80 border-slate-200/90 text-slate-800 hover:border-slate-300 hover:bg-white/95 shadow-sm'
        }`}
      >
        <span className="truncate">{buttonText}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 text-slate-400 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 mt-1.5 w-full min-w-[210px] max-w-xs rounded-2xl border shadow-2xl p-2.5 space-y-2 backdrop-blur-2xl z-[120] animate-in fade-in zoom-in-95 duration-150 ${
          isDark 
            ? 'bg-slate-950/95 border-white/20 text-slate-100 shadow-[0_15px_40px_rgba(0,0,0,0.85)]' 
            : 'bg-white/95 border-slate-200 text-slate-800 shadow-[0_15px_35px_rgba(100,116,139,0.3)]'
        }`}>
          {options.length > 6 && (
            <input
              type="text"
              placeholder="Search..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border focus:outline-none transition ${
                isDark 
                  ? 'bg-slate-800/80 border-white/10 text-slate-100 focus:border-indigo-500' 
                  : 'bg-slate-100/80 border-slate-200 text-slate-800 focus:border-indigo-500'
              }`}
            />
          )}

          <div className="flex items-center justify-between text-[11px] px-1 py-0.5 border-b border-inherit">
            <button
              type="button"
              onClick={selectAll}
              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-rose-500 hover:text-rose-600 font-bold hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1 text-xs pr-1">
            {filteredOptions.length === 0 ? (
              <div className="text-[11px] text-slate-400 p-2 text-center">No options match</div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition select-none ${
                      isChecked
                        ? 'bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/15 text-indigo-600 dark:text-indigo-300 font-semibold ring-1 ring-indigo-500/30'
                        : isDark
                          ? 'hover:bg-white/5 text-slate-300'
                          : 'hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <span className="truncate pr-2">{opt}</span>
                    {isChecked && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               ROOT DASHBOARD                               */
/* -------------------------------------------------------------------------- */
export default function App() {
  const [activeTab, setActiveTab] = useState('operations');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [theme, setTheme] = useState('dark');
  const isDark = theme === 'dark';

  const [opsData, setOpsData] = useState([]);
  const [usedData, setUsedData] = useState([]);
  const [approvalData, setApprovalData] = useState([]);

  const [isImportingAll, setIsImportingAll] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  // Auto-expanded when hovered or pinned via mobile drawer toggle
  const isExpanded = isSidebarOpen || isHovered;

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    let isMounted = true;
    async function loadCache() {
      const cachedOps = await getDbItem('csc_ops_data_v26');
      const cachedUsed = await getDbItem('csc_used_data_v26');
      const cachedApproval = await getDbItem('csc_approval_data_v26');

      if (isMounted) {
        if (cachedOps) setOpsData(cachedOps);
        if (cachedUsed) setUsedData(cachedUsed);
        if (cachedApproval) setApprovalData(cachedApproval);

        if (!cachedOps && !cachedUsed) {
          importAllSheets();
        }
      }
    }
    loadCache();
    return () => { isMounted = false; };
  }, []);

  const importAllSheets = useCallback(async () => {
    setIsImportingAll(true);
    setImportStatus({ type: 'info', message: 'Connecting to Google Sheets & fetching complete data...' });

    try {
      const opsResult = await fetchGoogleSheetData('Service Operations');
      const parsedOps = opsResult.rows.map(row => {
        const raw = row.__raw || Object.values(row);

        const srNumberVal = String(raw[0] !== undefined && raw[0] !== null ? raw[0] : (row['SR Number'] || row['Sr No'] || '')).trim();
        const srTypeVal = String(raw[1] !== undefined && raw[1] !== null ? raw[1] : (row['SR Type'] || '')).trim();
        const taskNoVal = String(raw[2] !== undefined && raw[2] !== null ? raw[2] : (row['Task No'] || '')).trim();
        const taskTypeVal = String(raw[3] !== undefined && raw[3] !== null ? raw[3] : (row['Task Type'] || '')).trim();
        const branchVal = String(raw[4] !== undefined && raw[4] !== null ? raw[4] : (row['Branch Name'] || '')).trim();
        const assigneeVal = String(raw[5] !== undefined && raw[5] !== null ? raw[5] : (row['Assignee'] || '')).trim();
        const taskNameVal = String(raw[7] !== undefined && raw[7] !== null ? raw[7] : (row['Task Name'] || '')).trim();
        const customerVal = String(raw[11] !== undefined && raw[11] !== null ? raw[11] : (row['Customer Name'] || '')).trim();
        const slNoVal = String(raw[14] !== undefined && raw[14] !== null ? raw[14] : (row['Serial No'] || row['Sl no'] || '')).trim();
        const descriptionVal = String(raw[15] !== undefined && raw[15] !== null ? raw[15] : (row['Product Description'] || row['desc'] || row['Description'] || '')).trim();
        const rawColQ = String(raw[16] !== undefined && raw[16] !== null ? raw[16] : (row['Problem Code'] || '')).trim();
        const problemCodeVal = (rawColQ && rawColQ !== '-' && rawColQ.toLowerCase() !== 'null') ? rawColQ : 'Not Specified';
        const rawStsOrDesc = String(raw[20] || raw[15] || '').trim();
        const categoryVal = parseCategoryValue(rawStsOrDesc);
        const rawSrDate = raw[23] !== undefined && raw[23] !== null ? raw[23] : (row['SR Date'] || '');
        const srDateVal = formatDate(rawSrDate);
        const rawTaskDate = raw[24] !== undefined && raw[24] !== null ? raw[24] : (row['Task Date'] || '');
        const taskDateVal = formatDate(rawTaskDate);
        const taskStatusVal = String(raw[37] !== undefined && raw[37] !== null ? raw[37] : (row['Task Status'] || '')).trim() || 'Pending';
        const srStatusVal = String(raw[38] !== undefined && raw[38] !== null ? raw[38] : (row['SR Status'] || '')).trim() || 'Pending';

        let productVal = String(raw[40] !== undefined && raw[40] !== null ? raw[40] : (row['Product'] || '')).trim();
        let modelVal = String(raw[41] !== undefined && raw[41] !== null ? raw[41] : (row['Model'] || '')).trim();

        if (/^\d+$/.test(productVal) || productVal.length > 50) productVal = '';
        if (modelVal.toLowerCase() === customerVal.toLowerCase() || /^\d+$/.test(modelVal) || modelVal.length > 40) {
          modelVal = '';
        }

        const dateObj = parseDate(rawTaskDate || rawSrDate);

        return {
          srNumber: srNumberVal || '-',
          srType: srTypeVal || 'General',
          taskNo: taskNoVal || '-',
          taskType: taskTypeVal || 'General',
          branch: branchVal || '-',
          customer: customerVal || '-',
          slNo: slNoVal || '-',
          description: descriptionVal || '-',
          srDate: srDateVal,
          taskDate: taskDateVal,
          taskStatus: taskStatusVal,
          srStatus: srStatusVal,
          product: productVal || '-',
          model: modelVal || '-',
          problemCode: problemCodeVal,
          category: categoryVal,
          assignee: assigneeVal,
          taskName: taskNameVal || '-',
          dateObj,
          formattedDate: taskDateVal !== '-' ? taskDateVal : srDateVal
        };
      }).filter(r => r.taskNo !== '-' || r.srNumber !== '-' || r.customer !== '-');

      await setDbItem('csc_ops_data_v26', parsedOps);
      setOpsData(parsedOps);

      const usedResult = await fetchGoogleSheetData('Spare Used');
      await setDbItem('csc_used_data_v25', usedResult.rows);
      await setDbItem('csc_used_headers_v25', usedResult.cols);
      setUsedData(usedResult.rows);

      const approvalResult = await fetchGoogleSheetData('Spare Approval');
      const approvalRows = approvalResult.rows.map((row, idx) => {
        const raw = row.__raw || Object.values(row);
        const rowArr = APPROVAL_COLUMN_HEADERS.map((h, hIdx) => {
          let val = row[h] !== undefined && row[h] !== '' ? row[h] : raw[hIdx];
          if (val !== null && typeof val === 'object') {
            val = val.f !== undefined && val.f !== null ? val.f : (val.v !== undefined ? val.v : '');
          }
          return val !== null && val !== undefined ? String(val).trim() : '';
        });
        return { index_: idx + 2, row: rowArr };
      });

      await setDbItem('csc_approval_data_v25', approvalRows);
      setApprovalData(approvalRows);

      setImportStatus({ 
        type: 'success', 
        message: `Imported successfully! Ops: ${parsedOps.length}, Used: ${usedResult.rows.length}, Approval: ${approvalRows.length}.` 
      });

      setTimeout(() => setImportStatus(null), 7000);
    } catch (err) {
      console.error(err);
      setImportStatus({ 
        type: 'error', 
        message: `Import failed: ${err.message}. Please check Google Sheets sharing.` 
      });
    } finally {
      setIsImportingAll(false);
    }
  }, []);

  const moduleTiles = [
    {
      id: 'operations',
      title: 'Service Operation',
      subtitle: 'Service Requests & Tasks',
      icon: Wrench,
      count: opsData.length,
      activeBorder: 'border-cyan-400/80 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-transparent text-cyan-600 dark:text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40',
      badgeBg: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-400/30'
    },
    {
      id: 'used',
      title: 'Spare Used',
      subtitle: 'Spares Used in All Tasks',
      icon: Layers,
      count: usedData.length,
      activeBorder: 'border-emerald-400/80 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-transparent text-emerald-600 dark:text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/40',
      badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30'
    },
    {
      id: 'approval',
      title: 'Spare Approval',
      subtitle: 'Non Commercial Spare Approvals',
      icon: CheckSquare,
      count: approvalData.length,
      activeBorder: 'border-fuchsia-400/80 bg-gradient-to-r from-purple-500/20 via-fuchsia-500/20 to-transparent text-fuchsia-600 dark:text-fuchsia-300 shadow-[0_0_20px_rgba(217,70,239,0.3)] ring-1 ring-fuchsia-400/40',
      badgeBg: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-400/30'
    }
  ];

  return (
    <div className={`h-screen w-screen overflow-hidden flex font-sans antialiased transition-colors duration-300 relative ${
      isDark ? 'bg-[#060814] text-slate-100' : 'bg-[#f4f7fc] text-slate-900'
    }`}>
      {/* VIBRANT AMBIENT GLOW BACKDROPS */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-blue-500/15 rounded-full blur-[128px] pointer-events-none" />
      <div className="fixed top-1/3 -right-40 w-96 h-96 bg-fuchsia-500/15 rounded-full blur-[128px] pointer-events-none" />
      <div className="fixed -bottom-40 left-1/3 w-96 h-96 bg-emerald-500/15 rounded-full blur-[128px] pointer-events-none" />

      {/* MOBILE DRAWER OVERLAY */}
      {isSidebarOpen && (
        <div 
          onClick={() => {
            setIsSidebarOpen(false);
            setIsHovered(false);
          }}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* FROZEN & AUTO-HIDE SIDEBAR */}
      <aside 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 h-full border-r transition-all duration-300 ease-in-out flex flex-col justify-between backdrop-blur-2xl ${
          isDark 
            ? 'bg-slate-950/90 border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.7)]' 
            : 'bg-white/90 border-slate-200/90 shadow-[0_4px_30px_rgba(0,0,0,0.08)]'
        } ${
          isSidebarOpen 
            ? 'translate-x-0 w-64' 
            : '-translate-x-full md:translate-x-0'
        } ${
          isExpanded ? 'md:w-64' : 'md:w-20'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* BRAND HEADER */}
          <div className={`h-16 flex items-center border-b border-inherit px-3.5 shrink-0 ${
            isExpanded ? 'justify-between' : 'justify-center'
          }`}>
            {isExpanded ? (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 text-white flex items-center justify-center font-extrabold text-xs shadow-md shrink-0">
                    CSC
                  </div>
                  <div className="min-w-0">
                    <h1 className="font-extrabold text-sm tracking-tight truncate bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
                      CSC Suite
                    </h1>
                    <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400 inline" /> Frozen Glass View
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setIsHovered(false);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-white/10 hover:text-slate-200 transition cursor-pointer md:hidden"
                  title="Close navigation"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 text-white flex items-center justify-center font-extrabold text-xs shadow-md">
                CSC
              </div>
            )}
          </div>

          {/* MODULE ITEMS LIST */}
          <div className="p-3 space-y-2 overflow-y-auto flex-1">
            {isExpanded && (
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                Modules
              </div>
            )}

            {moduleTiles.map((tile) => {
              const Icon = tile.icon;
              const isActive = activeTab === tile.id;
              return (
                <div
                  key={tile.id}
                  onClick={() => {
                    setActiveTab(tile.id);
                    // Automatically collapse sidebar on mobile
                    setIsSidebarOpen(false);
                  }}
                  className={`rounded-2xl border cursor-pointer transition-all duration-200 flex items-center justify-between p-3 select-none active:scale-[0.98] backdrop-blur-md ${
                    isActive
                      ? `${tile.activeBorder} shadow-lg`
                      : isDark
                        ? 'bg-slate-900/40 border-white/5 hover:border-white/15 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        : 'bg-white/40 border-slate-200/60 hover:border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  }`}
                  title={!isExpanded ? tile.title : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 transition-transform ${isActive ? 'scale-105' : ''} ${tile.badgeBg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {isExpanded && (
                      <div className="min-w-0">
                        <h3 className={`text-xs font-bold truncate ${isActive ? 'text-slate-900 dark:text-white' : ''}`}>
                          {tile.title}
                        </h3>
                        <p className="text-[10px] text-slate-400 truncate">
                          {tile.subtitle}
                        </p>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ml-1 ${tile.badgeBg}`}>
                      {tile.count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM THEME TOGGLE */}
        <div className="p-3 border-t border-inherit shrink-0">
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className={`w-full min-h-[42px] flex items-center justify-center gap-2 p-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer backdrop-blur-md active:scale-[0.98] ${
              isDark 
                ? 'bg-slate-900/50 border-white/10 hover:bg-white/10 text-slate-200 shadow-inner' 
                : 'bg-white/60 border-slate-200 hover:bg-white/90 text-slate-800 shadow-sm'
            }`}
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400 shrink-0" /> : <Moon className="w-4 h-4 text-indigo-600 shrink-0" />}
            {isExpanded && <span>{isDark ? 'Light Glass' : 'Dark Glass'}</span>}
          </button>
        </div>
      </aside>

      {/* INDEPENDENT SCROLLING WORKSPACE */}
      <div className={`flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-all duration-300 md:ml-20`}>
        {/* FROZEN TOP NAVIGATION BAR */}
        <header className={`h-16 px-3.5 sm:px-6 border-b shrink-0 flex items-center justify-between backdrop-blur-2xl transition-colors ${
          isDark ? 'bg-slate-950/70 border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.3)]' : 'bg-white/70 border-slate-200/80 shadow-xs'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-inherit text-slate-600 dark:text-slate-300 hover:bg-white/10 md:hidden cursor-pointer shrink-0"
              title="Open Navigation Drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight truncate bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
                CSC DASHBOARD
              </h1>
              <p className="text-[10px] text-slate-400">
                 <span className="font-bold text-cyan-600 dark:text-cyan-400 capitalize">{activeTab.replace('-', ' ')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={importAllSheets}
              disabled={isImportingAll}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 min-h-[40px] rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 hover:opacity-90 text-white text-xs font-bold shadow-[0_0_20px_rgba(99,102,241,0.4)] transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <DownloadCloud className={`w-3.5 h-3.5 ${isImportingAll ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{isImportingAll ? 'Importing All Sheets...' : 'Import Complete Data'}</span>
              <span className="sm:hidden">Import</span>
            </button>

            <button
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-inherit text-slate-600 dark:text-slate-300 hover:bg-white/10 transition md:hidden cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>
          </div>
        </header>

        {/* INDEPENDENT SCROLLING TAB CONTENT CONTAINER */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 space-y-6">
          {importStatus && (
            <div className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold backdrop-blur-xl transition duration-300 shadow-lg ${
              importStatus.type === 'error'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : importStatus.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
            }`}>
              <div className="flex items-center gap-2.5 truncate">
                {importStatus.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" /> : <Database className="w-4 h-4 shrink-0 text-cyan-400" />}
                <span className="truncate">{importStatus.message}</span>
              </div>
              <button onClick={() => setImportStatus(null)} className="cursor-pointer ml-2 p-1 hover:opacity-80">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeTab === 'operations' && (
            <ServiceOpsTab 
              isDark={isDark} 
              tasks={opsData} 
              setTasks={setOpsData} 
            />
          )}

          {activeTab === 'used' && (
            <SpareUsedTab 
              isDark={isDark} 
              items={usedData} 
              setItems={setUsedData} 
              tasks={opsData} 
            />
          )}

          {activeTab === 'approval' && (
            <SpareApprovalTab 
              isDark={isDark} 
              items={approvalData} 
              setItems={setApprovalData} 
            />
          )}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         TAB 1: SERVICE OPERATIONS TAB                      */
/* -------------------------------------------------------------------------- */
function ServiceOpsTab({ isDark, tasks = [], setTasks }) {
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false); // Collapsed by default (or set to true if you prefer open by default)
  const [search, setSearch] = useState('');
  const [selectedTaskTypes, setSelectedTaskTypes] = useState([]);
  
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedProblemCodes, setSelectedProblemCodes] = useState([]);
  const [selectedTaskStatuses, setSelectedTaskStatuses] = useState([]);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Filter dedicated to Top 5 Problem Codes Chart using COL AP (Model)
  const [chartSelectedModels, setChartSelectedModels] = useState([]);

  const [fromDateStr, setFromDateStr] = useState('');
  const [toDateStr, setToDateStr] = useState('');

  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [viewingTask, setViewingTask] = useState(null);

  const refreshOps = async () => {
    setLoading(true);
    try {
      const res = await fetchGoogleSheetData('Service Operations');
      const parsed = res.rows.map(row => {
        const raw = row.__raw || Object.values(row);

        const srNumberVal = String(raw[0] !== undefined && raw[0] !== null ? raw[0] : (row['SR Number'] || '')).trim();
        const rawSrDate = raw[1] !== undefined && raw[1] !== null ? raw[1] : (row['SR Date'] || '');
        const srDateVal = formatDate(rawSrDate);
        const srTypeVal = String(raw[2] !== undefined && raw[2] !== null ? raw[2] : (row['SR Type'] || '')).trim();
        const taskNoVal = String(raw[3] !== undefined && raw[3] !== null ? raw[3] : (row['Task No'] || '')).trim();
        const taskTypeVal = String(raw[4] !== undefined && raw[4] !== null ? raw[4] : (row['Task Type'] || '')).trim();
        const branchVal = String(raw[5] !== undefined && raw[5] !== null ? raw[5] : (row['Branch Name'] || '')).trim();
        const assigneeVal = String(raw[6] !== undefined && raw[6] !== null ? raw[6] : (row['Assignee'] || '')).trim();
        const taskNameVal = String(raw[7] !== undefined && raw[7] !== null ? raw[7] : (row['Task Name'] || '')).trim();
        
        // COL L: Customer Name (idx 11)
        const customerVal = String(raw[11] !== undefined && raw[11] !== null ? raw[11] : (row['Customer Name'] || '')).trim();

        // COL O: Sl No (idx 14)
        const slNoVal = String(raw[14] !== undefined && raw[14] !== null ? raw[14] : (row['Sl no'] || '')).trim();

        // COL P: Description (idx 15)
        const descriptionVal = String(raw[15] !== undefined && raw[15] !== null ? raw[15] : (row['desc'] || row['Description'] || '')).trim();

        // COL Q: Problem Code (idx 16)
        const rawColQ = String(raw[16] !== undefined ? raw[16] : '').trim();
        const problemCodeVal = (rawColQ && rawColQ !== '-') ? rawColQ : 'Not Specified';

        const rawColCategory = String(raw[17] || '').trim();
        const categoryVal = parseCategoryValue(rawColCategory);

        // COL Y: Task Date (idx 24)
        const rawTaskDate = raw[24] !== undefined && raw[24] !== null ? raw[24] : (row['Task Date'] || '');
        const taskDateVal = formatDate(rawTaskDate);

        // COL AL: Task Status (idx 37)
        const taskStatusVal = String(raw[37] !== undefined && raw[37] !== null ? raw[37] : (row['Task Status'] || '')).trim() || 'Pending';

        let productVal = String(raw[40] !== undefined && raw[40] !== null ? raw[40] : (row['Product'] || '')).trimS();
        
        // COL AP: Model (idx 41)
        let modelVal = String(raw[41] !== undefined && raw[41] !== null ? raw[41] : (row['Model'] || '')).trim();

        if (/^\d+$/.test(productVal) || productVal.length > 50) productVal = '';
        if (modelVal.toLowerCase() === customerVal.toLowerCase() || /^\d+$/.test(modelVal) || modelVal.length > 40) {
          modelVal = '';
        }

        const dateObj = parseDate(rawTaskDate || rawSrDate);

        return {
          srNumber: srNumberVal || '-',
          srType: srTypeVal || 'General',
          taskNo: taskNoVal || '-',
          taskType: taskTypeVal || 'General',
          branch: branchVal || '-',
          customer: customerVal || '-',
          slNo: slNoVal || '-',
          description: descriptionVal || '-',
          srDate: srDateVal,
          taskDate: taskDateVal,
          taskStatus: taskStatusVal,
          product: productVal || '-',
          model: modelVal || '-',
          problemCode: problemCodeVal,
          category: categoryVal,
          assignee: assigneeVal,
          taskName: taskNameVal || '-',
          dateObj,
          formattedDate: taskDateVal !== '-' ? taskDateVal : srDateVal
        };
      }).filter(r => r.taskNo !== '-' || r.srNumber !== '-' || r.customer !== '-');

      await setDbItem('csc_ops_data_v25', parsedOps);
      setTasks(parsedOps);
    } catch (e) {
      alert("Error refreshing Service Operations: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTaskType = (type) => {
    setCurrentPage(1);
    setSelectedTaskTypes(prev => {
      if (prev.includes(type)) return prev.filter(t => t !== type);
      return [...prev, type];
    });
  };

  const products = useMemo(() => {
    return Array.from(
      new Set(
        tasks.map(t => String(t.product || '').trim())
          .filter(p => p !== '' && p !== '-' && p !== 'null' && p !== 'undefined' && !/^\d+$/.test(p))
      )
    ).sort();
  }, [tasks]);

  // COL AP Model Options
  const models = useMemo(() => {
    return Array.from(
      new Set(
        tasks.map(t => String(t.model || '').trim())
          .filter(m => (
            m !== '' && 
            m !== '-' && 
            m !== 'null' && 
            m !== 'undefined' && 
            !/^\d+$/.test(m)
          ))
      )
    ).sort();
  }, [tasks]);

  // COL Q: Problem Codes only
  const problemCodes = useMemo(() => {
    return Array.from(
      new Set(
        tasks.map(t => String(t.problemCode || '').trim())
          .filter(code => code !== '' && code !== '-' && code.toLowerCase() !== 'not specified')
      )
    ).sort();
  }, [tasks]);

  // COL AL: Task Statuses only
  const taskStatuses = useMemo(() => {
    return Array.from(new Set(tasks.map(t => String(t.taskStatus || '').trim()).filter(s => s !== '' && s !== '-'))).sort();
  }, [tasks]);

  const branches = useMemo(() => {
    return Array.from(new Set(tasks.map(t => String(t.branch || '').trim()).filter(b => b !== '' && b !== '-'))).sort();
  }, [tasks]);

  const categories = ['Warranty', 'ASC', 'NA'];

  const taskTypeCounts = useMemo(() => {
    const counts = {};
    tasks.forEach(t => {
      const type = t.taskType || 'Unassigned';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [tasks]);

  const filtered = useMemo(() => {
    const parsedFrom = fromDateStr.trim() ? parseDate(fromDateStr.trim()) : null;
    const parsedTo = toDateStr.trim() ? parseDate(toDateStr.trim()) : null;

    if (parsedTo) {
      parsedTo.setHours(23, 59, 59, 999);
    }

    return tasks.filter(t => {
      if (selectedTaskTypes.length > 0 && !selectedTaskTypes.includes(t.taskType)) return false;
      if (selectedProducts.length > 0 && !selectedProducts.includes(t.product)) return false;
      if (selectedModels.length > 0 && !selectedModels.includes(t.model)) return false;
      if (selectedProblemCodes.length > 0 && !selectedProblemCodes.includes(t.problemCode)) return false;
      if (selectedTaskStatuses.length > 0 && !selectedTaskStatuses.includes(t.taskStatus)) return false;
      if (selectedBranches.length > 0 && !selectedBranches.includes(t.branch)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(t.category)) return false;

      if (t.dateObj) {
        if (parsedFrom && t.dateObj < parsedFrom) return false;
        if (parsedTo && t.dateObj > parsedTo) return false;
      } else if (parsedFrom || parsedTo) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.srNumber.toLowerCase().includes(q) ||
          t.srType.toLowerCase().includes(q) ||
          t.taskNo.toLowerCase().includes(q) ||
          t.taskType.toLowerCase().includes(q) ||
          t.branch.toLowerCase().includes(q) ||
          t.customer.toLowerCase().includes(q) ||
          t.product.toLowerCase().includes(q) ||
          t.model.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.slNo.toLowerCase().includes(q) ||
          t.taskStatus.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, selectedTaskTypes, selectedProducts, selectedModels, selectedProblemCodes, selectedTaskStatuses, selectedBranches, selectedCategories, fromDateStr, toDateStr, search]);

  const resetAllFilters = () => {
    setSelectedTaskTypes([]);
    setSelectedProducts([]);
    setSelectedModels([]);
    setSelectedProblemCodes([]);
    setSelectedTaskStatuses([]);
    setSelectedBranches([]);
    setSelectedCategories([]);
    setChartSelectedModels([]);
    setFromDateStr('');
    setToDateStr('');
    setSearch('');
    setCurrentPage(1);
  };

  const metrics = useMemo(() => {
    const total = filtered.length;
    let completed = 0;
    filtered.forEach(t => {
      const s = String(t.taskStatus).toLowerCase();
      if (s === 'completed' || s === 'closed' || s === 'resolved') completed++;
    });
    return {
      total,
      completed,
      pending: total - completed,
      rate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0
    };
  }, [filtered]);

  // Top 5 Problem Codes (From Col Q) with Isolated Model Filter (From Col AP)
  const { problemCodePieData, unassignedProblemCount } = useMemo(() => {
    const counts = {};
    let unassigned = 0;

    filtered.forEach(t => {
      if (chartSelectedModels.length > 0 && !chartSelectedModels.includes(t.model)) {
        return;
      }

      const code = String(t.problemCode || '').trim();
      if (!code || code === '-' || code.toLowerCase() === 'not specified' || code.toLowerCase() === 'unspecified') {
        unassigned++;
      } else {
        counts[code] = (counts[code] || 0) + 1;
      }
    });

    const specifiedEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top5 = specifiedEntries.slice(0, 5);
    const top5Total = top5.reduce((sum, [, count]) => sum + count, 0);

    const pieData = top5.map(([name, value]) => ({
      name,
      value,
      percent: top5Total > 0 ? ((value / top5Total) * 100).toFixed(1) : 0
    }));

    return {
      problemCodePieData: pieData,
      unassignedProblemCount: unassigned
    };
  }, [filtered, chartSelectedModels]);

  const branchChartData = useMemo(() => {
    const counts = {};
    filtered.forEach(t => { if (t.branch && t.branch !== '-') counts[t.branch] = (counts[t.branch] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, total]) => ({
      name: name.length > 8 ? `${name.substring(0, 7)}.` : name,
      fullName: name,
      total
    }));
  }, [filtered]);

  const modelChartData = useMemo(() => {
    const counts = {};
    filtered.forEach(t => { if (t.model && t.model !== '-') counts[t.model] = (counts[t.model] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, total]) => ({
      name: name.length > 8 ? `${name.substring(0, 7)}.` : name,
      fullName: name,
      total
    }));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize]);

  const isAnyFilterActive = 
    selectedTaskTypes.length > 0 || 
    selectedProducts.length > 0 || 
    selectedModels.length > 0 || 
    selectedProblemCodes.length > 0 || 
    selectedTaskStatuses.length > 0 || 
    selectedBranches.length > 0 || 
    selectedCategories.length > 0 || 
    chartSelectedModels.length > 0 ||
    fromDateStr.trim() !== '' || 
    toDateStr.trim() !== '' || 
    search.trim() !== '';

  const renderPieLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, value = '', percent = 0 }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.06) return null;

    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono text-[10px] font-bold pointer-events-none drop-shadow-md"
      >
        {value}
      </text>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Service Operations Workspace
          </h2>
          <p className="text-xs text-slate-400">
            Live feed connected to sheet <span className="font-semibold text-cyan-400">"Service Operations"</span>
          </p>
        </div>

        <button
          onClick={refreshOps}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(6,182,212,0.35)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 
          <span>Refresh</span>
        </button>
      </div>

      {/* TASK TYPE SUB-TILES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-cyan-400" /> Task Type Sub-Tiles
            {selectedTaskTypes.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 text-[10px] font-mono border border-cyan-400/30">
                {selectedTaskTypes.length} active
              </span>
            )}
          </span>
          {selectedTaskTypes.length > 0 && (
            <button
              onClick={() => { setSelectedTaskTypes([]); setCurrentPage(1); }}
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
          <div
            onClick={() => { setSelectedTaskTypes([]); setCurrentPage(1); }}
            className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between backdrop-blur-md active:scale-[0.98] ${
              selectedTaskTypes.length === 0
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-cyan-300/60 shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-2 ring-cyan-400/30'
                : isDark 
                  ? 'bg-slate-900/50 border-white/10 hover:border-white/20' 
                  : 'bg-white/60 border-slate-200/80 hover:border-slate-300 shadow-sm'
            }`}
          >
            <span className={`text-[11px] font-bold truncate ${selectedTaskTypes.length === 0 ? 'text-white' : 'text-slate-400'}`}>
              All Types
            </span>
            <span className="text-lg font-black mt-1">
              {tasks.length}
            </span>
          </div>

          {taskTypeCounts.map(([type, count]) => {
            const isSelected = selectedTaskTypes.includes(type);
            return (
              <div
                key={type}
                onClick={() => handleToggleTaskType(type)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between select-none backdrop-blur-md active:scale-[0.98] ${
                  isSelected
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-cyan-300/60 shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-2 ring-cyan-400/30'
                    : isDark 
                      ? 'bg-slate-900/50 border-white/10 hover:border-white/20' 
                      : 'bg-white/60 border-slate-200/80 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-white' : 'text-slate-400'}`} title={type}>
                    {type}
                  </span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 animate-ping" />}
                </div>
                <span className={`text-lg font-black mt-1 font-mono ${isSelected ? 'text-white' : 'text-cyan-500 dark:text-cyan-400'}`}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* OPERATIONAL FILTERS (COLLAPSIBLE) */}
      <div className={`p-4 rounded-3xl border backdrop-blur-2xl shadow-xl relative z-40 transition-all duration-300 ${
        isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200/90'
      }`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowFilters(prev => !prev)}
            className="flex items-center gap-2 cursor-pointer group select-none"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-cyan-400 transition-colors">
              Operational Filters
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
              isAnyFilterActive 
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30' 
                : 'bg-white/10 text-slate-400'
            }`}>
              {showFilters ? 'Hide' : 'Show'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {isAnyFilterActive && (
            <button
              onClick={resetAllFilters}
              className="text-xs text-rose-500 hover:text-rose-600 hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        {/* Expandable filter grid */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3 mt-4 animate-in fade-in duration-200">
            <MultiSelectDropdown
              label="Product"
              options={products}
              selected={selectedProducts}
              onChange={(val) => { setSelectedProducts(val); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Products"
            />

            <MultiSelectDropdown
              label="Model"
              options={models}
              selected={selectedModels}
              onChange={(val) => { setSelectedModels(val); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Models"
            />

            <MultiSelectDropdown
              label="Problem Code"
              options={problemCodes}
              selected={selectedProblemCodes}
              onChange={(val) => { setSelectedProblemCodes(val); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Problems"
            />

            <MultiSelectDropdown
              label="Task Status"
              options={taskStatuses}
              selected={selectedTaskStatuses}
              onChange={(val) => { setSelectedTaskStatuses(val); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Statuses"
            />

            <MultiSelectDropdown
              label="Business Unit"
              options={branches}
              selected={selectedBranches}
              onChange={(val) => { setSelectedBranches(val); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Branches"
            />

            <MultiSelectDropdown
              label="Category"
              options={categories}
              selected={selectedCategories}
              onChange={(val) => { setSelectedCategories(val); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Categories"
            />

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 truncate">
                From Date {fromDateStr && <span className="text-cyan-400 font-mono">({formatDate(fromDateStr)})</span>}
              </label>
              <input
                type="date"
                value={toISODateInput(fromDateStr)}
                onChange={(e) => {
                  if (!e.target.value) {
                    setFromDateStr('');
                  } else {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setFromDateStr(formatDate(new Date(y, m - 1, d)));
                  }
                  setCurrentPage(1);
                }}
                className={`w-full min-h-[42px] text-xs px-3 py-2 rounded-2xl border font-mono cursor-pointer transition backdrop-blur-md ${
                  isDark 
                    ? 'bg-slate-900/60 border-white/10 text-slate-200 focus:border-cyan-400 [color-scheme:dark]' 
                    : 'bg-white/70 border-slate-200 text-slate-800 focus:border-cyan-500 shadow-sm'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 truncate">
                To Date {toDateStr && <span className="text-cyan-400 font-mono">({formatDate(toDateStr)})</span>}
              </label>
              <input
                type="date"
                value={toISODateInput(toDateStr)}
                onChange={(e) => {
                  if (!e.target.value) {
                    setToDateStr('');
                  } else {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setToDateStr(formatDate(new Date(y, m - 1, d)));
                  }
                  setCurrentPage(1);
                }}
                className={`w-full min-h-[42px] text-xs px-3 py-2 rounded-2xl border font-mono cursor-pointer transition backdrop-blur-md ${
                  isDark 
                    ? 'bg-slate-900/60 border-white/10 text-slate-200 focus:border-cyan-400 [color-scheme:dark]' 
                    : 'bg-white/70 border-slate-200 text-slate-800 focus:border-cyan-500 shadow-sm'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 relative z-10">
        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-cyan-500/10 via-slate-900/70 to-blue-500/10 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
            : 'bg-gradient-to-br from-cyan-50/80 via-white/80 to-blue-50/80 border-cyan-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-cyan-500">
            TOTAL TASKS 
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Package className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-3xl font-black font-mono">
            {metrics.total.toLocaleString()}
          </div>
        </div>

        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-emerald-500/10 via-slate-900/70 to-teal-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
            : 'bg-gradient-to-br from-emerald-50/80 via-white/80 to-teal-50/80 border-emerald-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-emerald-500">
            COMPLETED TASKS
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-3xl font-black font-mono text-emerald-500">
            {metrics.completed.toLocaleString()}
          </div>
        </div>

        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-amber-500/10 via-slate-900/70 to-orange-500/10 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
            : 'bg-gradient-to-br from-amber-50/80 via-white/80 to-orange-50/80 border-amber-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-amber-500">
            PENDING TASKS
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-3xl font-black font-mono text-amber-500">
            {metrics.pending.toLocaleString()}
          </div>
        </div>

        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-fuchsia-500/10 via-slate-900/70 to-purple-500/10 border-fuchsia-500/30 shadow-[0_0_20px_rgba(217,70,239,0.2)]' 
            : 'bg-gradient-to-br from-fuchsia-50/80 via-white/80 to-purple-50/80 border-fuchsia-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-fuchsia-500">
            ACHIEVED PERCENTAGE 
            <div className="w-8 h-8 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
              <Percent className="w-4 h-4 text-fuchsia-400" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-3xl font-black font-mono text-fuchsia-500">
            {metrics.rate}%
          </div>
        </div>
      </div>

      {/* GLASS CHARTS WITH STRICT HORIZONTAL LABELS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
        <div className={`p-4 rounded-3xl border min-w-0 backdrop-blur-xl shadow-lg ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" /> Top 5 Branches
          </h3>
          <div className="w-full h-[230px] sm:h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155/30' : '#e2e8f0'} />
                <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} angle={0} textAnchor="middle" />
                <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                <Tooltip 
                  formatter={(val, name, item) => [`${val} tasks`, item?.payload?.fullName || '']}
                  contentStyle={{ 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', 
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
                    borderRadius: '1rem',
                    backdropFilter: 'blur(12px)'
                  }}
                />
                <Bar dataKey="total" fill="#38bdf8" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="total" position="top" fill={isDark ? "#bae6fd" : "#0284c7"} fontSize={10} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`p-4 rounded-3xl border min-w-0 backdrop-blur-xl shadow-lg ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Top 5 Models
          </h3>
          <div className="w-full h-[230px] sm:h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155/30' : '#e2e8f0'} />
                <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} angle={0} textAnchor="middle" />
                <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                <Tooltip 
                  formatter={(val, name, item) => [`${val} tasks`, item?.payload?.fullName || '']}
                  contentStyle={{ 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', 
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
                    borderRadius: '1rem',
                    backdropFilter: 'blur(12px)'
                  }}
                />
                <Bar dataKey="total" fill="#34d399" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="total" position="top" fill={isDark ? "#a7f3d0" : "#059669"} fontSize={10} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TOP 5 PROBLEM CODES (COL Q) WITH MODEL FILTER (COL AP) */}
        <div className={`p-4 rounded-3xl border flex flex-col justify-between backdrop-blur-xl shadow-lg relative ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-400" /> Top 5 Problem Codes
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Filter by Model
                </p>
              </div>

              <div className="w-full sm:w-44">
                <MultiSelectDropdown
                  label=""
                  options={models}
                  selected={chartSelectedModels}
                  onChange={(vals) => setChartSelectedModels(vals)}
                  isDark={isDark}
                  placeholder="Select Model"
                />
              </div>
            </div>

            {unassignedProblemCount > 0 && (
              <div className="text-right">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 bg-amber-500/15 text-amber-300 border-amber-400/30 font-bold inline-block">
                  Unspecified: {unassignedProblemCount}
                </span>
              </div>
            )}
          </div>

          <div className="w-full h-[220px] sm:h-[235px]">
            {problemCodePieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                {unassignedProblemCount > 0 ? 'All tasks are unassigned in Col Q' : 'No problem code records in Col Q'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    formatter={(val, name, item) => [`${val} tasks (${item.payload.percent}%)`, name]}
                    contentStyle={{ 
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', 
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
                      borderRadius: '1rem',
                      backdropFilter: 'blur(12px)'
                    }}
                  />
                  <Pie
                    data={problemCodePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="25%"
                    cy="45%"
                    innerRadius={5}
                    outerRadius={80}
                    paddingAngle={1}
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {problemCodePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke={isDark ? '#060814' : '#ffffff'} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Legend 
                    layout="vertival" 
                    verticalAlign="middle" 
                    align="right"
                    formatter={(value, entry) => (
                      <span className={isDark ? "text-slate-300 text-[px]" : "text-slate-700 text-[px]"}>
                        {value} (<strong className="text-red-400 font-mono">{entry.payload.value}</strong>)
                      </span>
                    )}
                    wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* GLASS RECORD FEED */}
      <div className={`rounded-3xl border overflow-hidden backdrop-blur-2xl shadow-xl relative z-10 ${
        isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200/90'
      }`}>
        <div className="p-3.5 sm:p-4 border-b flex flex-wrap items-center justify-between gap-3 border-inherit">
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search SR No, Customer, Model..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className={`text-xs pl-9 pr-3.5 py-2.5 rounded-2xl border w-full focus:outline-none transition backdrop-blur-md ${
                  isDark ? 'bg-slate-800/60 border-white/10 text-slate-100 focus:border-cyan-400' : 'bg-white/80 border-slate-200 text-slate-900 focus:border-cyan-500'
                }`}
              />
            </div>

            <div className={`flex items-center p-0.5 rounded-2xl border backdrop-blur-md ${
              isDark ? 'bg-slate-800/60 border-white/10' : 'bg-slate-100/80 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Table
              </button>
            </div>
          </div>

          <span className="text-[11px] text-slate-400 font-medium">
            Page {currentPage} of {totalPages} ({filtered.length} entries)
          </span>
        </div>

        {viewMode === 'grid' ? (
          <div className="p-3 sm:p-4 max-h-[680px] overflow-y-auto">
            {paginated.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No matching records found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {paginated.map((item, idx) => {
                  const tlCode = PRESET_BU_TO_TL[item.branch] || 'YKR';
                  const isCompleted = String(item.taskStatus).toLowerCase() === 'completed' || String(item.taskStatus).toLowerCase() === 'closed';

                  return (
                    <div
                      key={idx}
                      onClick={() => setViewingTask(item)}
                      className={`rounded-2xl border p-4 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-xl cursor-pointer hover:border-cyan-400/60 hover:-translate-y-0.5 active:scale-[0.98] backdrop-blur-md ${
                        isDark 
                          ? 'bg-slate-900/60 border-white/10 hover:bg-slate-800/60' 
                          : 'bg-white/70 border-slate-200/80 hover:bg-white/95'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                            <span className="font-extrabold text-sm text-cyan-400 font-mono tracking-tight">
                              {item.srNumber || '000000'}
                            </span>
                            {item.product && item.product !== '-' && (
                              <span className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-white/10 text-slate-500 border border-white/10">
                                {item.product}
                              </span>
                            )}
                          </div>

                          {/* COL AL: Task Status */}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border ${
                            isCompleted
                              ? 'bg-amber-500/15 text-amber-400 border-amber-400/30'
                              : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                          }`}>
                            {item.taskStatus}
                          </span>
                        </div>

                        {/* Customer Name from COL L */}
                        <div className="border-b border-inherit pb-1.5">
                          <span className="text-[10px] uppercase font text-blue-400 block">Customer:</span>
                          <h4 className="font-bold text-xs uppercase text-blue-400 truncate" title={item.customer}>
                            {item.customer || 'Unnamed Customer'}
                          </h4>
                        </div>

                        <div className="text-[11px] text-slate-400 leading-snug space-y-0.5">
                          {/* COL B: SR Date */}
                          <div className="truncate">
                            SR Date: <span className="font-semibold text-cyan-500 font-mono">{formatDate(item.srDate)}</span>
                          </div>
                          <div className="truncate">
                            Task No: <span className="font-mono font-bold text-amber-500">{item.taskNo || '-'}</span>
                          </div>
                          {/* COL Y: Task Date */}
                          <div className="truncate">
                            Task Date: <span className="font-semibold text-amber-500 font-mono">{formatDate(item.taskDate)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 truncate">
                          <span className="font-semibold text-slate-500 truncate">{item.branch || '-'}</span>
                          <span>•</span>
                          <span>TL: {tlCode}</span>
                          <span>•</span>
                          <span className="font-bold text-teal-500">{item.category}</span>
                        </div>

                        <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 backdrop-blur-sm ${
                          isDark 
                            ? 'bg-slate-800/40 border-white/5 text-slate-200' 
                            : 'bg-slate-50/80 border-slate-200 text-slate-700'
                        }`}>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-slate-400 text-[11px]">Model:</span>
                            <span className="font-bold uppercase tracking-tight text-right truncate text-emerald-500">
                              {item.model || '-'}
                            </span>
                          </div>
                          {/* COL O: Sl No */}
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-slate-400 text-[11px] shrink-0">Serial No.:</span>
                            <span className="font-mono font-semibold text-right truncate text-[11px]">
                              {item.slNo}
                            </span>
                          </div>
                          {/* COL P: Desc */}
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-slate-400 text-[11px] shrink-0">Description:</span>
                            <span 
                              className="font-medium text-left wrap text-[10px] max-w-[200px]" 
                              title={item.description}
                            >
                              {item.description}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2.5 mt-2.5 border-t border-inherit flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-[10px] uppercase text-cyan-500 bg-cyan-500/15 px-1.5 py-0.5 rounded-lg border border-cyan-400/30">
                            {item.srType}
                          </span>
                          <span className="font-bold text-[10px] uppercase text-amber-500 bg-amber-500/15 px-1.5 py-0.5 rounded-lg border border-amber-400/30">
                            {item.taskType}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className={`uppercase text-[10px] tracking-wider border-b border-inherit sticky top-0 backdrop-blur-xl ${
                isDark ? 'bg-slate-900/90 text-slate-200' : 'bg-slate-100/90 text-slate-700 font-bold'
              }`}>
                <tr>
                  <th className="py-3 px-3.5 whitespace-nowrap">SR NO</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">SR Date</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Customer Name</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task Date</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task Status</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Model</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Serial No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Description</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Problem Code</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">BU Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-400">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((row, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => setViewingTask(row)}
                      className="hover:bg-white/5 cursor-pointer transition"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-cyan-500 whitespace-nowrap">
                        {row.srNumber}
                      </td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap text-cyan-500">
                        {formatDate(row.srDate)}
                      </td>
                      <td className="py-3 px-3.5 text-blue-500 truncate max-w-[150px] font-medium" title={row.customer}>
                        {row.customer}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-amber-500 whitespace-nowrap font-bold">
                        {row.taskNo}
                      </td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap text-amber-500">
                        {formatDate(row.taskDate)}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          String(row.taskStatus).toLowerCase() === 'completed'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-400/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-400/30'
                        }`}>
                          {row.taskStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-emerald-500 font-semibold whitespace-nowrap">
                        {row.model}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-500 whitespace-nowrap">
                        {row.slNo}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 truncate max-w-[150px]" title={row.description}>
                        {row.description}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-indigo-400 whitespace-nowrap">
                        {row.problemCode}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-500">
                        {row.branch}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 border-t border-inherit flex items-center justify-between text-xs text-slate-400">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="px-3.5 py-1.5 min-h-[36px] rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-bold transition"
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="px-3.5 py-1.5 min-h-[36px] rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-bold transition"
          >
            Next
          </button>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {viewingTask && (
        <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl backdrop-blur-2xl ${
            isDark ? 'bg-slate-900/95 border-white/15 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]' : 'bg-white/95 border-slate-200 text-slate-900'
          }`}>
            <div className="p-4 border-b flex items-center justify-between border-inherit">
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-calibri font-bold text-cyan-400 text-base">SERVICE REQUEST: {viewingTask.srNumber}</span>
                <span className="font-calibri font-bold text-cyan-400 text-base"> | {viewingTask.srDate}</span>
                <span className="font-calibri font-bold text-cyan-400 text-base"> | </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 font-bold uppercase">{viewingTask.srType}</span>
                <span className="font-calibri font-bold text-cyan-400 text-base"> | </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 font-bold uppercase">{viewingTask.srStatus}</span>
              </div>
            </div>
            
            <div className="p-4 border-b flex items-center justify-between border-inherit">
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-calibri font-bold text-amber-400 text-base">TASK: {viewingTask.taskNo}</span>
                <span className="font-calibri font-bold text-amber-400 text-base"> | {viewingTask.taskDate}</span>
                <span className="font-calibri font-bold text-amber-400 text-base"> | </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 font-bold uppercase">{viewingTask.taskType}</span>
                <span className="font-calibri font-bold text-amber-400 text-base"> | </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 font-bold uppercase">{viewingTask.taskStatus}</span>
              </div>
              <button onClick={() => setViewingTask(null)} className="cursor-pointer text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block mb-0.5 font-bold">Customer Name</span>
                  <strong className="text-sm block">{viewingTask.customer}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block mb-0.5 font-bold">Model</span>
                  <strong className="text-sm block text-emerald-400">{viewingTask.model}</strong>
                </div>
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">Serial No</span>
                  <strong className="font-calibri">{viewingTask.slNo}</strong>
                </div>
                
              </div>
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-3">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                <span className="text-slate-400 block font-bold">Description</span>
                <strong className="font-calibri">{viewingTask.description}</strong>
                </div>
               </div> 
              
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                
                  <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block font-bold">Business Unit</span>
                  <strong className="text-amber-700 font-bold">{viewingTask.branch}</strong>
                </div>

                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                <span className="text-slate-400 block font-bold">Problem Code</span>
                <p className="font-calibri text-red-500 font-bold">{viewingTask.problemCode}</p>
              </div>

              </div>

              
            </div>

            <div className="p-4 border-t flex justify-end border-inherit">
              <button
                onClick={() => setViewingTask(null)}
                className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] text-xs font-bold rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-white cursor-pointer transition shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                            TAB 2: SPARE USED TAB                           */
/* -------------------------------------------------------------------------- */
function SpareUsedTab({ isDark, items = [], setItems, tasks = [] }) {
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [viewMode, setViewMode] = useState('grid');
  const safeItems = Array.isArray(items) ? items : [];

  const [selectedTaskTypes, setSelectedTaskTypes] = useState([]);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [fromDateStr, setFromDateStr] = useState('');
  const [toDateStr, setToDateStr] = useState('');

  const [modelChartSelectedModels, setModelChartSelectedModels] = useState([]);
  const [sparesInModelSelectedModel, setSparesInModelSelectedModel] = useState('');
  const [sparesInModelLimit, setSparesInModelLimit] = useState(5);

  const [viewingSpare, setViewingSpare] = useState(null);

  const PIE_COLORS = ['#38bdf8', '#34d399', '#f43f5e', '#fbbf24', '#a855f7', '#06b6d4'];

  useEffect(() => {
    let isMounted = true;
    async function loadHeaders() {
      try {
        const h = await getDbItem('csc_used_headers_v25');
        if (isMounted && h && Array.isArray(h)) setHeaders(h);
      } catch (err) {
        console.warn("Could not load cached headers:", err);
      }
    }
    loadHeaders();
    return () => { isMounted = false; };
  }, []);

  const refreshUsed = async () => {
    setLoading(true);
    try {
      const res = await fetchGoogleSheetData('Spare Used');
      await setDbItem('csc_used_data_v25', res.rows);
      await setDbItem('csc_used_headers_v25', res.cols);
      if (setItems) setItems(res.rows);
      setHeaders(res.cols);
    } catch (e) {
      alert("Error refreshing Spare Used: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /*            NORMALIZED DATA: COLS A (0) THROUGH W (22)                    */
  /* ------------------------------------------------------------------------ */
  const normalizedData = useMemo(() => {
    const list = new Array(safeItems.length);

    for (let i = 0; i < safeItems.length; i++) {
      const r = safeItems[i];
      const raw = r.__raw || [];

      // Col A (0): Task Number
      const taskNo = String(
        raw[0] !== undefined && raw[0] !== null 
          ? raw[0] 
          : (r['Task Number'] || r['Task No'] || r['Task No.'] || '')
      ).trim() || '-';

      // Col B (1): Last Task Status Updated Date
      const rawDate = raw[1] !== undefined && raw[1] !== null 
        ? raw[1] 
        : (r['Last Task Status Updated Date'] || r['Date'] || r['Task Date'] || '');
      const dateObj = rawDate ? parseDate(rawDate) : null;
      const formattedDate = dateObj ? formatDate(dateObj) : (rawDate ? String(rawDate).trim() : '-');

      // Col C (2): Sr Type (Task Type)
      const taskType = String(
        raw[2] !== undefined && raw[2] !== null 
          ? raw[2] 
          : (r['Sr Type'] || r['Task Type'] || '')
      ).trim() || '-';

      // Col D (3): Bu Name (Branch)
      const branch = String(
        raw[3] !== undefined && raw[3] !== null 
          ? raw[3] 
          : (r['Bu Name'] || r['Branch'] || r['Branch Name'] || '')
      ).trim() || '-';

      // Col E (4): Bu Code
      const buCode = String(raw[4] !== undefined && raw[4] !== null ? raw[4] : (r['Bu Code'] || '')).trim() || '-';

      // Col F (5): Assignee
      const assignee = String(raw[5] !== undefined && raw[5] !== null ? raw[5] : (r['Assignee'] || '')).trim() || '-';

      // Col G (6): Customer Ticket No
      const ticketNo = String(raw[6] !== undefined && raw[6] !== null ? raw[6] : (r['Customer Ticket No'] || '')).trim() || '-';

      // Col H (7): Customer Name
      const customerName = String(raw[7] !== undefined && raw[7] !== null ? raw[7] : (r['Customer Name'] || '')).trim() || '-';

      // Col I (8): Location Code
      const locationCode = String(raw[8] !== undefined && raw[8] !== null ? raw[8] : (r['Location Code'] || '')).trim() || '-';

      // Col J (9): Product Ship Date
      const rawShipDate = raw[9] !== undefined && raw[9] !== null ? raw[9] : (r['Product Ship Date'] || '');
      const shipDateObj = rawShipDate ? parseDate(rawShipDate) : null;
      const shipDate = shipDateObj ? formatDate(shipDateObj) : (rawShipDate ? String(rawShipDate).trim() : '-');

      // Col K (10): Product Status
      const status = String(raw[10] !== undefined && raw[10] !== null ? raw[10] : (r['Product Status'] || r['Status'] || '')).trim() || '-';

      // Col L (11): Resolution Description / Labour Reason
      const resolutionDesc = String(
        raw[11] !== undefined && raw[11] !== null 
          ? raw[11] 
          : (r['Resolution Description'] || r['Labour Reason'] || '')
      ).trim() || '-';

      // Col M (12): Finished Goods
      const finishedGoods = String(raw[12] !== undefined && raw[12] !== null ? raw[12] : (r['Finished Goods'] || '')).trim() || '-';

      // Col N (13): Category
      const category = String(raw[13] !== undefined && raw[13] !== null ? raw[13] : (r['Category'] || r['Product Category'] || '')).trim() || '-';

      // Col O (14): Machine Serial No
      const slNo = String(raw[14] !== undefined && raw[14] !== null ? raw[14] : (r['Machine Serial No'] || r['Sl No'] || '')).trim() || '-';

      // Col P (15): Product Description
      const description = String(raw[15] !== undefined && raw[15] !== null ? raw[15] : (r['Product Description'] || r['Description'] || '')).trim() || '-';

      // Col Q (16): Problem Description
      const problemDesc = String(raw[16] !== undefined && raw[16] !== null ? raw[16] : (r['Problem Description'] || '')).trim() || '-';

      // Col R (17): Corrective Measure Status
      const correctiveStatus = String(raw[17] !== undefined && raw[17] !== null ? raw[17] : (r['Corrective Measure Status'] || '')).trim() || '-';

      // Col S (18): Part Code
      let rawColS = raw[18] !== undefined && raw[18] !== null ? raw[18] : (r['Part Code'] || r['Part No'] || '');
      let partCode = '';
      if (typeof rawColS === 'object' && rawColS !== null) {
        partCode = String(rawColS.v || rawColS.f || '').trim();
      } else {
        partCode = String(rawColS).trim();
      }
      partCode = partCode && partCode !== '-' && partCode.toLowerCase() !== 'null' ? partCode : '-';

      // Col T (19): Part Description
      const partDesc = String(raw[19] !== undefined && raw[19] !== null ? raw[19] : (r['Part Description'] || '')).trim() || '-';

      // Col U (20): Item Quantity
      const rawQty = raw[20] !== undefined && raw[20] !== null ? raw[20] : (r['Item Quantity'] || r['Qty'] || 1);
      const quantity = !isNaN(Number(rawQty)) && Number(rawQty) > 0 ? Number(rawQty) : 1;

      // Col V (21): Product
      const product = String(raw[21] !== undefined && raw[21] !== null ? raw[21] : (r['Product'] || r['Product Name'] || '')).trim() || '-';

      // Col W (22): Model
      const model = String(raw[22] !== undefined && raw[22] !== null ? raw[22] : (r['Model'] || r['Model Name'] || '')).trim() || '-';

      list[i] = {
        rawItem: r,
        taskNo,
        dateObj,
        formattedDate,
        taskType,
        branch,
        buCode,
        assignee,
        ticketNo,
        customerName,
        locationCode,
        shipDate,
        status,
        resolutionDesc,
        finishedGoods,
        category,
        slNo,
        description,
        problemDesc,
        correctiveStatus,
        partCode,
        partDesc,
        quantity,
        product,
        model
      };
    }

    return list;
  }, [safeItems]);

  const { filterOptions, taskTypeCounts } = useMemo(() => {
    const branches = new Set();
    const statuses = new Set();
    const categories = new Set();
    const models = new Set();
    const products = new Set();
    const taskTypeMap = {};

    for (let i = 0; i < normalizedData.length; i++) {
      const row = normalizedData[i];
      if (row.branch !== '-') branches.add(row.branch);
      if (row.status !== '-') statuses.add(row.status);
      if (row.category !== '-') categories.add(row.category);
      if (row.model !== '-') models.add(row.model);
      if (row.product !== '-') products.add(row.product);

      if (row.taskType !== '-') {
        taskTypeMap[row.taskType] = (taskTypeMap[row.taskType] || 0) + 1;
      }
    }

    return {
      filterOptions: {
        branches: Array.from(branches).sort(),
        statuses: Array.from(statuses).sort(),
        categories: Array.from(categories).sort(),
        models: Array.from(models).sort(),
        products: Array.from(products).sort()
      },
      taskTypeCounts: Object.entries(taskTypeMap).sort((a, b) => b[1] - a[1])
    };
  }, [normalizedData]);

  const dateRangeLabel = useMemo(() => {
    if (fromDateStr && toDateStr) return `${formatDate(fromDateStr)} to ${formatDate(toDateStr)}`;
    if (fromDateStr) return `From ${formatDate(fromDateStr)}`;
    if (toDateStr) return `Up to ${formatDate(toDateStr)}`;
    return 'All Dates';
  }, [fromDateStr, toDateStr]);

  const dateFilteredItems = useMemo(() => {
    const from = fromDateStr.trim() ? parseDate(fromDateStr.trim()) : null;
    const to = toDateStr.trim() ? parseDate(toDateStr.trim()) : null;
    if (to) to.setHours(23, 59, 59, 999);

    if (!from && !to) return normalizedData;

    return normalizedData.filter(r => {
      if (!r.dateObj) return false;
      if (from && r.dateObj < from) return false;
      if (to && r.dateObj > to) return false;
      return true;
    });
  }, [normalizedData, fromDateStr, toDateStr]);

  const mainFilteredItems = useMemo(() => {
    const from = fromDateStr.trim() ? parseDate(fromDateStr.trim()) : null;
    const to = toDateStr.trim() ? parseDate(toDateStr.trim()) : null;
    if (to) to.setHours(23, 59, 59, 999);

    const q = search.trim().toLowerCase();
    const hasTaskType = selectedTaskTypes.length > 0;
    const hasBranch = selectedBranches.length > 0;
    const hasStatus = selectedStatuses.length > 0;
    const hasCat = selectedCategories.length > 0;
    const hasModel = selectedModels.length > 0;
    const hasProd = selectedProducts.length > 0;

    return normalizedData.filter(r => {
      if (hasTaskType && !selectedTaskTypes.includes(r.taskType)) return false;
      if (hasBranch && !selectedBranches.includes(r.branch)) return false;
      if (hasStatus && !selectedStatuses.includes(r.status)) return false;
      if (hasCat && !selectedCategories.includes(r.category)) return false;
      if (hasModel && !selectedModels.includes(r.model)) return false;
      if (hasProd && !selectedProducts.includes(r.product)) return false;

      if (r.dateObj) {
        if (from && r.dateObj < from) return false;
        if (to && r.dateObj > to) return false;
      } else if (from || to) {
        return false;
      }

      if (q) {
        return (
          r.taskNo.toLowerCase().includes(q) ||
          r.partCode.toLowerCase().includes(q) ||
          r.partDesc.toLowerCase().includes(q) ||
          r.slNo.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.ticketNo.toLowerCase().includes(q) ||
          r.assignee.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.locationCode.toLowerCase().includes(q) ||
          r.model.toLowerCase().includes(q) ||
          r.branch.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [
    normalizedData, selectedTaskTypes, selectedBranches, selectedStatuses,
    selectedCategories, selectedModels, selectedProducts, fromDateStr, toDateStr, search
  ]);

  const operationalMetrics = useMemo(() => {
    const partMap = new Map();
    const productCounts = {};
    const modelCounts = {};
    const branchModelCounts = {};

    for (let i = 0; i < mainFilteredItems.length; i++) {
      const r = mainFilteredItems[i];

      const partKey = `${r.partCode}:::${r.partDesc}`;
      if (!partMap.has(partKey)) {
        partMap.set(partKey, { partDesc: r.partDesc, partCode: r.partCode, usageCount: 0 });
      }
      partMap.get(partKey).usageCount += r.quantity;

      if (r.product !== '-') {
        productCounts[r.product] = (productCounts[r.product] || 0) + r.quantity;
      }

      if (r.model !== '-') {
        modelCounts[r.model] = (modelCounts[r.model] || 0) + r.quantity;
      }

      if (r.branch !== '-' && r.model !== '-') {
        const bmKey = `${r.branch}:::${r.model}`;
        branchModelCounts[bmKey] = (branchModelCounts[bmKey] || 0) + 1;
      }
    }

    const sortedParts = Array.from(partMap.values()).sort((a, b) => b.usageCount - a.usageCount);
    const sortedProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]);
    const sortedModels = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);

    const sortedBranchModels = Object.entries(branchModelCounts).sort((a, b) => b[1] - a[1]);
    let topBranchModelPair = null;
    if (sortedBranchModels.length > 0) {
      const [bmKey, count] = sortedBranchModels[0];
      const [branchName, modelName] = bmKey.split(':::');
      topBranchModelPair = { branch: branchName, model: modelName, count };
    }

    const top5PartsChartData = sortedParts.slice(0, 5).map(item => ({
      name: item.partDesc.length > 8 ? `${item.partDesc.substring(0, 7)}.` : item.partDesc,
      fullName: item.partDesc,
      partCode: item.partCode,
      quantity: item.usageCount
    }));

    const totalProdCount = sortedProducts.reduce((sum, [, count]) => sum + count, 0);
    const productWiseChartData = sortedProducts.slice(0, 5).map(([name, count]) => ({
      name,
      value: count,
      percent: totalProdCount > 0 ? ((count / totalProdCount) * 100).toFixed(1) : 0
    }));

    return {
      top5PartsChartData,
      productWiseChartData,
      uniquePartsCount: sortedParts.length,
      mostUsedPart: sortedParts[0] || null,
      mostUsedModel: sortedModels[0] || null,
      topBranchModelPair
    };
  }, [mainFilteredItems]);

  const modelWiseChartData = useMemo(() => {
    const modelCounts = {};

    for (let i = 0; i < dateFilteredItems.length; i++) {
      const r = dateFilteredItems[i];
      if (r.model !== '-') {
        modelCounts[r.model] = (modelCounts[r.model] || 0) + r.quantity;
      }
    }

    const sortedModels = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);
    let finalModels = sortedModels;

    if (modelChartSelectedModels.length > 0) {
      finalModels = sortedModels.filter(([m]) => modelChartSelectedModels.includes(m));
    } else {
      finalModels = sortedModels.slice(0, 5);
    }

    return finalModels.map(([name, count]) => ({
      name: name.length > 8 ? `${name.substring(0, 7)}.` : name,
      fullName: name,
      quantity: count
    }));
  }, [dateFilteredItems, modelChartSelectedModels]);

  const sparesInModelData = useMemo(() => {
    const targetModel = sparesInModelSelectedModel || filterOptions.models[0] || '';
    if (!targetModel) return { targetModel: '', chartData: [], totalCount: 0 };

    const partMap = new Map();
    const tLower = targetModel.toLowerCase();

    for (let i = 0; i < dateFilteredItems.length; i++) {
      const r = dateFilteredItems[i];
      if (r.model.toLowerCase() === tLower) {
        const partKey = `${r.partCode}:::${r.partDesc}`;
        if (!partMap.has(partKey)) {
          partMap.set(partKey, { partDesc: r.partDesc, partCode: r.partCode, count: 0 });
        }
        partMap.get(partKey).count += r.quantity;
      }
    }

    const sortedParts = Array.from(partMap.values()).sort((a, b) => b.count - a.count);
    const limitNum = sparesInModelLimit === 'ALL' ? sortedParts.length : Number(sparesInModelLimit);
    const chartData = sortedParts.slice(0, limitNum).map(item => ({
      name: item.partDesc.length > 8 ? `${item.partDesc.substring(0, 7)}.` : item.partDesc,
      fullName: item.partDesc,
      partCode: item.partCode,
      quantity: item.count
    }));

    return {
      targetModel,
      chartData,
      totalCount: sortedParts.length
    };
  }, [dateFilteredItems, sparesInModelSelectedModel, sparesInModelLimit, filterOptions.models]);

  const resetAllOperationalFilters = () => {
    setSelectedTaskTypes([]);
    setSelectedBranches([]);
    setSelectedStatuses([]);
    setSelectedCategories([]);
    setSelectedModels([]);
    setSelectedProducts([]);
    setFromDateStr('');
    setToDateStr('');
    setSearch('');
    setCurrentPage(1);
  };

  const isAnyFilterActive = 
    selectedTaskTypes.length > 0 ||
    selectedBranches.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedCategories.length > 0 ||
    selectedModels.length > 0 ||
    selectedProducts.length > 0 ||
    fromDateStr.trim() !== '' ||
    toDateStr.trim() !== '' ||
    search.trim() !== '';

  const totalPages = Math.max(1, Math.ceil(mainFilteredItems.length / pageSize));
  const paginated = useMemo(() => {
    return mainFilteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [mainFilteredItems, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            Spare Parts Consumption & Analytics
          </h2>
          <p className="text-xs text-slate-400">
            Real-time analytics for spares consumed across operations
          </p>
        </div>

        <button
          onClick={refreshUsed}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.35)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* TASK TYPE SUB-TILES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-400" /> Task Type Sub-Tiles
            {selectedTaskTypes.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-mono border border-emerald-400/30">
                {selectedTaskTypes.length} active
              </span>
            )}
          </span>
          {selectedTaskTypes.length > 0 && (
            <button
              onClick={() => { setSelectedTaskTypes([]); setCurrentPage(1); }}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
          <div
            onClick={() => { setSelectedTaskTypes([]); setCurrentPage(1); }}
            className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between backdrop-blur-md active:scale-[0.98] ${
              selectedTaskTypes.length === 0
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-300/60 shadow-[0_0_20px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/30'
                : isDark 
                  ? 'bg-slate-900/50 border-white/10 hover:border-white/20' 
                  : 'bg-white/60 border-slate-200/80 hover:border-slate-300 shadow-sm'
            }`}
          >
            <span className={`text-[11px] font-bold truncate ${selectedTaskTypes.length === 0 ? 'text-white' : 'text-slate-400'}`}>
              All Types
            </span>
            <span className="text-lg font-black mt-1">
              {normalizedData.length}
            </span>
          </div>

          {taskTypeCounts.map(([type, count]) => {
            const isSelected = selectedTaskTypes.includes(type);
            return (
              <div
                key={type}
                onClick={() => {
                  setSelectedTaskTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
                  setCurrentPage(1);
                }}
                className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between select-none backdrop-blur-md active:scale-[0.98] ${
                  isSelected
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-300/60 shadow-[0_0_20px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/30'
                    : isDark 
                      ? 'bg-slate-900/50 border-white/10 hover:border-white/20' 
                      : 'bg-white/60 border-slate-200/80 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-white' : 'text-slate-400'}`} title={type}>
                    {type}
                  </span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 animate-ping" />}
                </div>
                <span className={`text-lg font-black mt-1 font-mono ${isSelected ? 'text-white' : 'text-emerald-500 dark:text-emerald-400'}`}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* OPERATIONAL FILTERS (COLLAPSIBLE) */}
      <div className={`p-4 rounded-3xl border backdrop-blur-2xl shadow-xl relative z-40 transition-all duration-300 ${
        isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200/90'
      }`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowFilters(prev => !prev)}
            className="flex items-center gap-2 cursor-pointer group select-none"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-emerald-400 transition-colors">
              Operational Filters
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
              isAnyFilterActive 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                : 'bg-white/10 text-slate-400'
            }`}>
              {showFilters ? 'Hide' : 'Show'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {isAnyFilterActive && (
            <button
              onClick={resetAllOperationalFilters}
              className="text-xs text-rose-500 hover:text-rose-600 hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7 gap-3 mt-4 animate-in fade-in duration-200">
            <MultiSelectDropdown
              label="Branch"
              options={filterOptions.branches}
              selected={selectedBranches}
              onChange={(val) => { setSelectedBranches(val); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Branches"
            />

            <MultiSelectDropdown
              label="Status"
              options={filterOptions.statuses}
              selected={selectedStatuses}
              onChange={(val) => { setSelectedStatuses(val); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Statuses"
            />

            <MultiSelectDropdown
              label="Category"
              options={filterOptions.categories}
              selected={selectedCategories}
              onChange={(val) => { setSelectedCategories(val); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Categories"
            />

            <MultiSelectDropdown
              label="Model"
              options={filterOptions.models}
              selected={selectedModels}
              onChange={(val) => { setSelectedModels(val); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Models"
            />

            <MultiSelectDropdown
              label="Product"
              options={filterOptions.products}
              selected={selectedProducts}
              onChange={(val) => { setSelectedProducts(val); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Products"
            />

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 truncate">
                From Date
              </label>
              <input
                type="date"
                value={toISODateInput(fromDateStr)}
                onChange={(e) => {
                  if (!e.target.value) setFromDateStr('');
                  else {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setFromDateStr(formatDate(new Date(y, m - 1, d)));
                  }
                  setCurrentPage(1);
                }}
                className={`w-full min-h-[42px] text-xs px-3 py-2 rounded-2xl border font-mono cursor-pointer transition backdrop-blur-md ${
                  isDark 
                    ? 'bg-slate-900/60 border-white/10 text-slate-200 focus:border-emerald-400 [color-scheme:dark]' 
                    : 'bg-white/70 border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 truncate">
                To Date
              </label>
              <input
                type="date"
                value={toISODateInput(toDateStr)}
                onChange={(e) => {
                  if (!e.target.value) setToDateStr('');
                  else {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setToDateStr(formatDate(new Date(y, m - 1, d)));
                  }
                  setCurrentPage(1);
                }}
                className={`w-full min-h-[42px] text-xs px-3 py-2 rounded-2xl border font-mono cursor-pointer transition backdrop-blur-md ${
                  isDark 
                    ? 'bg-slate-900/60 border-white/10 text-slate-200 focus:border-emerald-400 [color-scheme:dark]' 
                    : 'bg-white/70 border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 relative z-10">
        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-emerald-500/10 via-slate-900/70 to-teal-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
            : 'bg-gradient-to-br from-emerald-50/80 via-white/80 to-teal-50/80 border-emerald-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-slate-400">
            <span>CONSUMED ROWS</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-3xl font-black font-mono">
            {mainFilteredItems.length.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate">
            {mainFilteredItems.length !== normalizedData.length ? `${mainFilteredItems.length} matching filters` : 'All logged spare rows'}
          </div>
        </div>

        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-cyan-500/10 via-slate-900/70 to-blue-500/10 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
            : 'bg-gradient-to-br from-cyan-50/80 via-white/80 to-blue-50/80 border-cyan-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-cyan-400">
            <span>UNIQUE SPARES</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-3xl font-black font-mono text-cyan-400">
            {operationalMetrics.uniquePartsCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate">
            Distinct parts consumed
          </div>
        </div>

        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-amber-500/10 via-slate-900/70 to-yellow-500/10 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
            : 'bg-gradient-to-br from-amber-50/80 via-white/80 to-yellow-50/80 border-amber-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-amber-400">
            <span>TOP SPARE & MODEL</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Tag className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-xs font-bold truncate text-slate-100" title={operationalMetrics.mostUsedPart?.partDesc}>
              {operationalMetrics.mostUsedPart?.partDesc || 'N/A'}
              <span className="text-[10px] text-cyan-400 font-mono font-bold ml-1">
                ({operationalMetrics.mostUsedPart?.usageCount || 0}u)
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate flex items-center justify-between">
              <span>Top Model:</span>
              <strong className="text-emerald-400 truncate max-w-[120px]">
                {operationalMetrics.mostUsedModel?.[0] || 'N/A'} ({operationalMetrics.mostUsedModel?.[1] || 0}u)
              </strong>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-fuchsia-500/10 via-slate-900/70 to-purple-500/10 border-fuchsia-500/30 shadow-[0_0_20px_rgba(217,70,239,0.2)]' 
            : 'bg-gradient-to-br from-fuchsia-50/80 via-white/80 to-purple-50/80 border-fuchsia-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-fuchsia-400">
            <span>BRANCH TRANSACTIONS</span>
            <div className="w-8 h-8 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
              <Package className="w-4 h-4 text-fuchsia-400" />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-xs font-bold truncate text-slate-100">
              {operationalMetrics.topBranchModelPair ? operationalMetrics.topBranchModelPair.branch : 'No Data'}
              {operationalMetrics.topBranchModelPair && (
                <span className="text-[10px] text-fuchsia-400 font-mono font-bold ml-1">
                  ({operationalMetrics.topBranchModelPair.count} txns)
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate flex items-center justify-between">
              <span>Top Model:</span>
              <strong className="text-emerald-400 truncate max-w-[120px]">
                {operationalMetrics.topBranchModelPair ? operationalMetrics.topBranchModelPair.model : 'N/A'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
        <div className={`p-4 rounded-3xl border min-w-0 backdrop-blur-xl shadow-lg ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-cyan-400" /> Top 5 Spares Used
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Date: <strong className="text-cyan-400 font-mono">{dateRangeLabel}</strong>
              </p>
            </div>
          </div>

          <div className="w-full h-[230px] sm:h-[260px]">
            {operationalMetrics.top5PartsChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No spare records in this date range</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={operationalMetrics.top5PartsChartData} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155/30' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} angle={0} textAnchor="middle" />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [`${val} units consumed`, item?.payload?.fullName || '']}
                    contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '1rem', backdropFilter: 'blur(12px)' }}
                  />
                  <Bar dataKey="quantity" fill="#38bdf8" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#bae6fd" : "#0284c7"} fontSize={10} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`p-4 rounded-3xl border min-w-0 backdrop-blur-xl shadow-lg ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-fuchsia-400" /> Product Wise Spare Used
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Date: <strong className="text-fuchsia-400 font-mono">{dateRangeLabel}</strong>
              </p>
            </div>
          </div>

          <div className="w-full h-[230px] sm:h-[260px]">
            {operationalMetrics.productWiseChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No product records in this date range</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(val, name, item) => [`${val} parts (${item?.payload?.percent || 0}%)`, name]}
                    contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '1rem', backdropFilter: 'blur(12px)' }}
                  />
                  <Pie
                    data={operationalMetrics.productWiseChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    cy="45%"
                    innerRadius={10}
                    outerRadius={80}
                    paddingAngle={1}
                  >
                    {operationalMetrics.productWiseChartData.map((entry, index) => (
                      <Cell key={`pie-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke={isDark ? '#060814' : '#ffffff'} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    formatter={(value, entry) => (
                      <span className={isDark ? 'text-slate-300 text-[10px]' : 'text-slate-700 text-[10px]'}>
                        {value} (<strong className="font-mono text-cyan-400">{entry?.payload?.value || 0}</strong>)
                      </span>
                    )}
                    wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
        <div className={`p-4 rounded-3xl border min-w-0 backdrop-blur-xl shadow-lg ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-400" /> Model Wise Spare Used
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Date: <strong className="text-emerald-400 font-mono">{dateRangeLabel}</strong>
              </p>
            </div>

            <div className="w-full sm:w-56">
              <MultiSelectDropdown
                label=""
                options={filterOptions.models}
                selected={modelChartSelectedModels}
                onChange={(vals) => setModelChartSelectedModels(vals)}
                isDark={isDark}
                placeholder="Select Models (Top 5)"
              />
            </div>
          </div>

          <div className="w-full h-[230px] sm:h-[260px]">
            {modelWiseChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No model records in this date range</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelWiseChartData} margin={{ top: 16, right: 10, left: -22, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155/30' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} angle={0} textAnchor="middle" />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [`${val} spares replaced`, item?.payload?.fullName || '']}
                    contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '1rem', backdropFilter: 'blur(12px)' }}
                  />
                  <Bar dataKey="quantity" fill="#34d399" radius={[6, 6, 0, 0]} className="cursor-pointer">
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#a7f3d0" : "#059669"} fontSize={10} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`p-4 rounded-3xl border min-w-0 backdrop-blur-xl shadow-lg ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="truncate">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 truncate">
                <Wrench className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">
                  Spares in: <strong className="text-cyan-400">{sparesInModelData.targetModel || 'Select Model'}</strong>
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                Date: <strong className="text-cyan-400 font-mono">{dateRangeLabel}</strong>
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-1.5 shrink-0">
              <div className={`flex items-center p-0.5 rounded-2xl border backdrop-blur-md text-[10px] font-bold ${
                isDark ? 'bg-slate-800/60 border-white/10' : 'bg-slate-100/80 border-slate-200'
              }`}>
                {[5, 10, 'ALL'].map((lim) => (
                  <button
                    key={lim}
                    type="button"
                    onClick={() => setSparesInModelLimit(lim)}
                    className={`px-2.5 py-1 rounded-xl transition cursor-pointer ${
                      sparesInModelLimit === lim
                        ? 'bg-cyan-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lim === 'ALL' ? 'All' : `Top ${lim}`}
                  </button>
                ))}
              </div>

              <select
                value={sparesInModelSelectedModel || sparesInModelData.targetModel || ''}
                onChange={(e) => setSparesInModelSelectedModel(e.target.value)}
                className={`text-xs px-3 py-2 rounded-2xl border font-bold cursor-pointer transition backdrop-blur-md ${
                  sparesInModelSelectedModel
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                    : isDark ? 'bg-slate-900/60 border-white/10 text-slate-200' : 'bg-white/80 border-slate-200 text-slate-800'
                }`}
              >
                <option value="" disabled>Select Model</option>
                {filterOptions.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full h-[230px] sm:h-[260px]">
            {sparesInModelData.chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                {sparesInModelData.targetModel ? `No spares recorded for model "${sparesInModelData.targetModel}"` : 'Select a model'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sparesInModelData.chartData} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155/30' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} angle={0} textAnchor="middle" />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [`${val} units consumed`, item?.payload?.fullName || '']}
                    contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '1rem', backdropFilter: 'blur(12px)' }}
                  />
                  <Bar dataKey="quantity" fill="#2dd4bf" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#99f6e4" : "#0f766e"} fontSize={10} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* SPARE USED FEED */}
      <div className={`rounded-3xl border overflow-hidden backdrop-blur-2xl shadow-xl relative z-10 ${
        isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200/90'
      }`}>
        <div className="p-3.5 sm:p-4 border-b flex flex-wrap items-center justify-between gap-3 border-inherit">
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search part, code, sl no, loc..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className={`text-xs pl-9 pr-3.5 py-2.5 rounded-2xl border w-full focus:outline-none transition backdrop-blur-md ${
                  isDark ? 'bg-slate-800/60 border-white/10 text-slate-100 focus:border-emerald-400' : 'bg-white/80 border-slate-200 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>

            <div className={`flex items-center p-0.5 rounded-2xl border backdrop-blur-md ${
              isDark ? 'bg-slate-800/60 border-white/10' : 'bg-slate-100/80 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Table
              </button>
            </div>
          </div>

          <span className="text-[11px] text-slate-400 font-medium">
            Page {currentPage} of {totalPages} ({mainFilteredItems.length} records)
          </span>
        </div>

        {viewMode === 'grid' ? (
          <div className="p-3 sm:p-4 max-h-[680px] overflow-y-auto">
            {paginated.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No matching records found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {paginated.map((row, idx) => (
                  <div
                    key={idx}
                    onClick={() => setViewingSpare(row)}
                    className={`rounded-2xl border p-4 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-xl cursor-pointer hover:border-emerald-400/60 hover:-translate-y-0.5 active:scale-[0.98] backdrop-blur-md ${
                      isDark 
                        ? 'bg-slate-900/60 border-white/10 hover:bg-slate-800/60' 
                        : 'bg-white/70 border-slate-200/80 hover:bg-white/95'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-xs text-blue-400 truncate">
                            {row.taskNo}
                          </span>
                          <span className="font-bold text-[9px] uppercase text-amber-500 bg-amber-500/15 px-1.5 py-0.5 rounded-lg border border-amber-400/30 truncate">
                            {row.taskType}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 bg-blue-500/15 text-blue-500 border border-blue-400/30 font-mono">
                          Loc: {row.locationCode}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-xs uppercase text-indigo-400 truncate" title={row.partDesc}>
                          {row.partDesc}
                        </h4>
                        <div className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
                          Branch: {row.branch}
                        </div>
                      </div>

                      <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 backdrop-blur-sm ${
                        isDark ? 'bg-slate-800/40 border-white/5 text-slate-200' : 'bg-slate-50/80 border-slate-200 text-slate-700'
                      }`}>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Sl No:</span>
                          <span className="font-mono font-bold text-right truncate text-[11px]">
                            {row.slNo}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Model:</span>
                          <span className="font-bold uppercase tracking-tight text-right truncate text-emerald-400">
                            {row.model}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Status:</span>
                          <span className="font-medium text-right truncate text-[11px] text-blue-400">
                            {row.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Category:</span>
                          <span className="font-semibold text-right wrap text-teal-400 text-[11px]">
                            {row.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 mt-2.5 border-t border-inherit">
                      <div className="text-[11px] text-slate-400 truncate flex items-center justify-between font-mono">
                        <span>Part Code:</span>
                        <span className="font-bold text-slate-500" title={row.partCode}>
                          {row.partCode}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className={`uppercase text-[10px] tracking-wider border-b border-inherit sticky top-0 backdrop-blur-xl ${
                isDark ? 'bg-slate-900/90 text-slate-200' : 'bg-slate-100/90 text-slate-700 font-bold'
              }`}>
                <tr>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task Number</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Date</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Sr Type</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">BU Name</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Customer Name</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Location Code</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Part Code</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Part Description</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Qty</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Machine Sl No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Product</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Model</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Status</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-12 text-slate-400">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((row, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => setViewingSpare(row)}
                      className="hover:bg-white/5 cursor-pointer transition"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-blue-500 whitespace-nowrap">
                        {row.taskNo}
                      </td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap text-slate-500">
                        {row.formattedDate}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-400/30">
                          {row.taskType}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-500">
                        {row.branch}
                      </td>
                      <td className="py-3 px-3.5 max-w-[150px] truncate text-slate-500" title={row.customerName}>
                        {row.customerName}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-500 whitespace-nowrap">
                        {row.locationCode}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-500 whitespace-nowrap">
                        {row.partCode}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 max-w-[180px] truncate" title={row.partDesc}>
                        {row.partDesc}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-cyan-500 whitespace-nowrap">
                        {row.quantity}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-500 whitespace-nowrap">
                        {row.slNo}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap max-w-[130px] truncate" title={row.product}>
                        {row.product}
                      </td>
                      <td className="py-3 px-3.5 text-emerald-500 font-semibold whitespace-nowrap">
                        {row.model}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-500 border border-blue-400/30">
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/15 text-teal-500 border border-teal-400/30">
                          {row.category}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 border-t border-inherit flex items-center justify-between text-xs text-slate-400">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="px-3.5 py-1.5 min-h-[36px] rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-bold transition"
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="px-3.5 py-1.5 min-h-[36px] rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-bold transition"
          >
            Next
          </button>
        </div>
      </div>

      {/* DETAIL MODAL WITH FULL COLUMN COVERAGE */}
      {viewingSpare && (
        <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-3xl max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl backdrop-blur-2xl ${
            isDark ? 'bg-slate-900/95 border-white/15 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]' : 'bg-white/95 border-slate-200 text-slate-900'
          }`}>
            <div className="p-4 border-b flex items-center justify-between border-inherit">
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-mono font-bold text-blue-400 text-base">
                  {viewingSpare.taskNo}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 font-bold uppercase">
                  {viewingSpare.taskType}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-400/30 font-bold uppercase font-mono">
                  Loc: {viewingSpare.locationCode}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 font-bold uppercase font-mono">
                  Qty: {viewingSpare.quantity}
                </span>
              </div>
              <button onClick={() => setViewingSpare(null)} className="cursor-pointer text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block mb-0.5 font-bold">Part Description</span>
                  <strong className="text-slate-500 block">{viewingSpare.partDesc}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block mb-0.5 font-bold">Customer Name</span>
                  <strong className="text-sm block text-slate-500">{viewingSpare.customerName}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">BU Name</span>
                  <strong className="text-slate-500 text-sm truncate block">{viewingSpare.branch}</strong>
                </div>
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">BU Code</span>
                  <strong className="font-mono text-sm text-slate-500">{viewingSpare.buCode}</strong>
                </div>
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">Ticket No</span>
                  <strong className="font-mono text-sm text-amber-500 truncate block">{viewingSpare.ticketNo}</strong>
                </div>
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">Assignee</span>
                  <strong className="text-sm truncate block">{viewingSpare.assignee}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-00 block font-bold">Part Code</span>
                  <strong className="text-blue-500 font-mono text-sm truncate block">{viewingSpare.partCode}</strong>
                </div>
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">Machine Sl No</span>
                  <strong className="font-mono text-sm truncate block">{viewingSpare.slNo}</strong>
                </div>
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">Product</span>
                  <strong className="text-sm truncate block text-slate-500">{viewingSpare.product}</strong>
                </div>
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">Model</span>
                  <strong className="text-emerald-500 text-sm truncate block">{viewingSpare.model}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">Status</span>
                  <strong className="text-blue-500">{viewingSpare.status}</strong>
                </div>
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">Category</span>
                  <strong className="text-teal-500">{viewingSpare.category}</strong>
                </div>
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">Ship Date</span>
                  <strong className="font-mono text-slate-500">{viewingSpare.shipDate}</strong>
                </div>
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-slate-400 block font-bold">Corrective Status</span>
                  <strong className="text-slate-500 truncate block">{viewingSpare.correctiveStatus}</strong>
                </div>
              </div>

              {(viewingSpare.description !== '-' || viewingSpare.problemDesc !== '-' || viewingSpare.resolutionDesc !== '-') && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {viewingSpare.description !== '-' && (
                    <div className="p-2.5 bg-white/5 rounded-xl">
                      <span className="text-slate-400 block font-bold mb-0.5">Product Description</span>
                      <p className="text-slate-500 font-bold">{viewingSpare.description}</p>
                    </div>
                  )}
                  {viewingSpare.problemDesc !== '-' && (
                    <div className="p-2.5 bg-white/5 rounded-xl">
                      <span className="text-slate-400 block font-bold mb-0.5">Problem Description</span>
                      <p className="text-slate-200">{viewingSpare.problemDesc}</p>
                    </div>
                  )}
                  {viewingSpare.resolutionDesc !== '-' && (
                    <div className="p-2.5 bg-white/5 rounded-xl">
                      <span className="text-slate-400 block font-bold mb-0.5">Resolution / Labour Reason</span>
                      <p className="text-slate-200">{viewingSpare.resolutionDesc}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t flex justify-end border-inherit">
              <button
                onClick={() => setViewingSpare(null)}
                className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] text-xs font-bold rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer transition shadow-[0_0_15px_rgba(16,185,129,0.4)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           TAB 3: SPARE APPROVAL TAB                         */
/* -------------------------------------------------------------------------- */

// Safe Date Helper Fallbacks
const safeParseDate = (d) => {
  if (!d) return null;
  if (typeof parseDate === 'function') {
    try { return parseDate(d); } catch (e) {}
  }
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const safeFormatDate = (d) => {
  if (!d) return '';
  if (typeof formatDate === 'function') {
    try { return formatDate(d); } catch (e) {}
  }
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return String(d);
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const safeToISODateInput = (dStr) => {
  if (!dStr) return '';
  if (typeof toISODateInput === 'function') {
    try { return toISODateInput(dStr); } catch (e) {}
  }
  const parsed = safeParseDate(dStr);
  if (!parsed || isNaN(parsed.getTime())) return '';
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

function SpareApprovalTab({ isDark, items = [], setItems }) {
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedBUs, setSelectedBUs] = useState([]);
  const [fromDateStr, setFromDateStr] = useState('');
  const [toDateStr, setToDateStr] = useState('');

  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [drilldownBU, setDrilldownBU] = useState('');
  const [rmrChartBU, setRmrChartBU] = useState('All');
  const [modalState, setModalState] = useState({ isOpen: false, item: null, isAdd: false });

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const extractAnyFormatCell = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if (val.f !== undefined && val.f !== null && String(val.f).trim() !== '') {
        return String(val.f).trim();
      }
      if (val.v !== undefined && val.v !== null) {
        return String(val.v).trim();
      }
      return '';
    }
    return String(val).trim();
  };

  const getTransactionBadge = (type) => {
    const t = String(type || '').trim().toUpperCase();
    if (t.includes('RMR')) return 'bg-purple-500/15 text-purple-300 border-purple-400/30';
    if (t.includes('ICSL')) return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
    if (t.includes('ST')) return 'bg-blue-500/15 text-blue-300 border-blue-400/30';
    if (t.includes('CSC WARRANTY') || t.includes('WARRANTY')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
    if (t.includes('PBS')) return 'bg-rose-500/15 text-rose-300 border-rose-400/30';
    return 'bg-slate-500/15 text-slate-300 border-slate-400/30';
  };

  const getStatusBadge = (status) => {
    const st = String(status || '').toLowerCase();
    if (st === 'approved') return 'bg-emerald-500/15 text-emerald-400 border-emerald-400/30';
    if (st === 'rejected') return 'bg-rose-500/15 text-rose-400 border-rose-400/30';
    return 'bg-amber-500/15 text-amber-400 border-amber-400/30';
  };

  // Normalizes items into the unified format required across the component and modal
  const normalizedApprovals = useMemo(() => {
    const list = new Array(safeItems.length);

    for (let i = 0; i < safeItems.length; i++) {
      const r = safeItems[i] || {};
      const raw = Array.isArray(r.row) ? r.row : (Array.isArray(r.__raw) ? r.__raw : (Array.isArray(r) ? r : []));

      // 19-Column Schema with fallback to original raw column positions & object keys
      const reqNumber = String(
        raw[0] !== undefined && raw[0] !== null
          ? raw[0]
          : (r['Req No'] || r['Req Number'] || r['Requisition Number'] || r['Requisition No'] || (i + 1))
      ).trim() || String(i + 1);

      const rawDate = raw[1] !== undefined && raw[1] !== null
        ? raw[1]
        : (r['Req Date'] || r['Date'] || r['Last Task Status Updated Date'] || '');
      const dateObj = rawDate ? safeParseDate(rawDate) : null;
      const reqDate = dateObj ? safeFormatDate(dateObj) : (rawDate ? String(rawDate).trim() : '-');

      const orderNumber = String(
        raw[2] !== undefined && raw[2] !== null
          ? raw[2]
          : (r['Order Number'] || r['Order No'] || '')
      ).trim() || '-';

      const requesterComment = String(
        raw[3] !== undefined && raw[3] !== null
          ? raw[3]
          : (r['Requester Comment'] || r['Comment'] || '')
      ).trim() || '-';

      const buName = String(
        raw[4] !== undefined && raw[4] !== null
          ? raw[4]
          : (raw[3] !== undefined ? raw[3] : (r['Bu Name'] || r['Branch'] || r['Branch Name'] || r['BU Name'] || ''))
      ).trim() || '-';

      const taskOwner = String(
        raw[5] !== undefined && raw[5] !== null
          ? raw[5]
          : (r['Task Owner'] || r['TL Name'] || r['TL'] || '')
      ).trim() || '-';

      let rawPartCode = raw[6] !== undefined && raw[6] !== null
        ? raw[6]
        : (raw[18] !== undefined ? raw[18] : (r['Part Code'] || r['Part No'] || ''));
      let partCode = '';
      if (typeof rawPartCode === 'object' && rawPartCode !== null) {
        partCode = String(rawPartCode.v || rawPartCode.f || '').trim();
      } else {
        partCode = String(rawPartCode || '').trim();
      }
      partCode = partCode && partCode !== '-' && partCode.toLowerCase() !== 'null' ? partCode : '-';

      const partDescription = String(
        raw[7] !== undefined && raw[7] !== null
          ? raw[7]
          : (raw[19] !== undefined ? raw[19] : (r['Part Description'] || r['Part Decription'] || ''))
      ).trim() || '-';

      const rawQty = raw[8] !== undefined && raw[8] !== null
        ? raw[8]
        : (raw[20] !== undefined ? raw[20] : (r['Item Quantity'] || r['Quantity'] || r['Qty'] || 1));
      const quantity = !isNaN(Number(rawQty)) ? Number(rawQty) : 1;

      const rawPrice = raw[9] !== undefined && raw[9] !== null
        ? raw[9]
        : (r['Price'] || r['Amount'] || 0);
      const price = !isNaN(Number(rawPrice)) ? Number(rawPrice) : 0;

      const taskNo = String(
        raw[10] !== undefined && raw[10] !== null
          ? raw[10]
          : (raw[0] !== undefined ? raw[0] : (r['Task Number'] || r['Task No'] || r['Task No.'] || ''))
      ).trim() || '-';

      const orderedBy = String(
        raw[11] !== undefined && raw[11] !== null ? raw[11] : (r['Ordered By'] || '')
      ).trim() || '-';

      const partTransaction = String(
        raw[12] !== undefined && raw[12] !== null
          ? raw[12]
          : (raw[2] !== undefined ? raw[2] : (r['Part Transaction'] || r['Transaction'] || r['Sr Type'] || 'RMR'))
      ).trim() || 'RMR';

      const transactionType = String(
        raw[13] !== undefined && raw[13] !== null ? raw[13] : (r['Transaction Type'] || '')
      ).trim() || '-';

      const taxCategory = String(
        raw[14] !== undefined && raw[14] !== null ? raw[14] : (r['Tax Category'] || '')
      ).trim() || '-';

      const approvalStatus = String(
        raw[15] !== undefined && raw[15] !== null ? raw[15] : (r['Approval Status'] || r['Approval'] || 'Pending')
      ).trim() || 'Pending';

      const status = String(
        raw[16] !== undefined && raw[16] !== null
          ? raw[16]
          : (raw[10] !== undefined ? raw[10] : (r['Product Status'] || r['Status'] || 'Processed'))
      ).trim() || 'Processed';

      const rawStatusDate = raw[17] !== undefined && raw[17] !== null ? raw[17] : (r['Status Date'] || '');
      const statusDate = rawStatusDate ? safeFormatDate(rawStatusDate) : '-';

      const remarks = String(
        raw[18] !== undefined && raw[18] !== null ? raw[18] : (r['Remarks'] || '')
      ).trim() || '-';

      // Assemble fallback raw array for the edit modal
      const rawRow = Array.isArray(r.row)
        ? r.row
        : [
            reqNumber,
            reqDate,
            orderNumber,
            requesterComment,
            buName,
            taskOwner,
            partCode,
            partDescription,
            quantity,
            price,
            taskNo,
            orderedBy,
            partTransaction,
            transactionType,
            taxCategory,
            approvalStatus,
            status,
            statusDate,
            remarks
          ];

      list[i] = {
        index_: r.index_ !== undefined ? r.index_ : i,
        rawItem: r,
        rawRow,
        reqNumber,
        reqDate,
        dateObj,
        orderNumber,
        requesterComment,
        buName,
        taskOwner,
        partCode,
        partDescription,
        quantity,
        price,
        taskNo,
        orderedBy,
        partTransaction,
        transactionType,
        taxCategory,
        approvalStatus,
        status,
        statusDate,
        remarks
      };
    }

    return list;
  }, [safeItems]);

  const nextReqNumber = useMemo(() => {
    let maxNumber = 0;
    let prefix = '';
    let hasMatch = false;

    normalizedApprovals.forEach((item) => {
      const val = String(item.reqNumber || '').trim();
      if (!val || val === 'N/A' || val === '-') return;

      const match = val.match(/^(.*?)(\d+)$/);
      if (match) {
        const currentPrefix = match[1];
        const num = parseInt(match[2], 10);
        if (num > maxNumber) {
          maxNumber = num;
          prefix = currentPrefix;
          hasMatch = true;
        }
      } else {
        const digits = val.match(/\d+/g);
        if (digits) {
          const num = parseInt(digits[digits.length - 1], 10);
          if (num > maxNumber) {
            maxNumber = num;
            hasMatch = true;
          }
        }
      }
    });

    if (!hasMatch || maxNumber === 0) {
      return String(normalizedApprovals.length + 1);
    }

    const nextVal = maxNumber + 1;
    return prefix ? `${prefix}${nextVal}` : String(nextVal);
  }, [normalizedApprovals]);

  const { allBUs, allStatuses } = useMemo(() => {
    const buSet = new Set();
    const statusSet = new Set();
    normalizedApprovals.forEach((item) => {
      if (item.buName && item.buName !== '-') buSet.add(item.buName);
      if (item.approvalStatus && item.approvalStatus !== '-') statusSet.add(item.approvalStatus);
    });
    return {
      allBUs: Array.from(buSet).sort(),
      allStatuses: Array.from(statusSet).sort()
    };
  }, [normalizedApprovals]);

  const filteredApprovals = useMemo(() => {
    const from = fromDateStr.trim() ? safeParseDate(fromDateStr.trim()) : null;
    const to = toDateStr.trim() ? safeParseDate(toDateStr.trim()) : null;
    if (to) to.setHours(23, 59, 59, 999);

    const q = search.trim().toLowerCase();

    return normalizedApprovals
      .filter((item) => {
        if (selectedStatus.length > 0 && !selectedStatus.includes(item.approvalStatus)) return false;
        if (selectedBUs.length > 0 && !selectedBUs.includes(item.buName)) return false;

        if (item.dateObj) {
          if (from && item.dateObj < from) return false;
          if (to && item.dateObj > to) return false;
        } else if (from || to) {
          return false;
        }

        if (q) {
          return (
            item.reqNumber.toLowerCase().includes(q) ||
            item.taskNo.toLowerCase().includes(q) ||
            item.partCode.toLowerCase().includes(q) ||
            item.partDescription.toLowerCase().includes(q) ||
            item.buName.toLowerCase().includes(q) ||
            item.orderNumber.toLowerCase().includes(q) ||
            item.taskOwner.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Extract numeric sequence from requisition identifiers (e.g., "REQ-105" -> 105)
        const numA = parseInt(String(a.reqNumber).replace(/\D/g, ''), 10);
        const numB = parseInt(String(b.reqNumber).replace(/\D/g, ''), 10);

        const validA = !isNaN(numA);
        const validB = !isNaN(numB);

        if (validA && validB && numA !== numB) {
          return numB - numA; // Descending numeric sort
        }

        // Fallback to natural alphanumeric descending sort
        return String(b.reqNumber || '').localeCompare(String(a.reqNumber || ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });
  }, [normalizedApprovals, selectedStatus, selectedBUs, fromDateStr, toDateStr, search]);

  const metrics = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let totalAccPrice = 0;
    const partsCountMap = {};

    filteredApprovals.forEach((a) => {
      const st = a.approvalStatus.toLowerCase();
      if (st === 'approved') approved++;
      else if (st === 'rejected') rejected++;
      else pending++;

      totalAccPrice += a.price;

      if (a.partCode && a.partCode !== 'N/A' && a.partCode !== '-') {
        if (!partsCountMap[a.partCode]) {
          partsCountMap[a.partCode] = { code: a.partCode, desc: a.partDescription, qty: 0, cost: 0 };
        }
        partsCountMap[a.partCode].qty += a.quantity;
        partsCountMap[a.partCode].cost += a.price;
      }
    });

    const sortedParts = Object.values(partsCountMap).sort((a, b) => b.qty - a.qty);
    const topPart = sortedParts[0] || null;

    return {
      total: filteredApprovals.length,
      approved,
      pending,
      rejected,
      totalAccPrice,
      topPart
    };
  }, [filteredApprovals]);

  const topPartsChartData = useMemo(() => {
    const partsMap = {};
    filteredApprovals.forEach((item) => {
      if (item.partCode && item.partCode !== 'N/A' && item.partCode !== '-') {
        partsMap[item.partCode] = (partsMap[item.partCode] || 0) + item.quantity;
      }
    });

    return Object.entries(partsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, qty]) => ({
        name: code.length > 14 ? `${code.substring(0, 12)}...` : code,
        fullCode: code,
        quantity: qty
      }));
  }, [filteredApprovals]);

  const topBUsChartData = useMemo(() => {
    const buMap = {};
    filteredApprovals.forEach((item) => {
      if (item.buName && item.buName !== '-') {
        buMap[item.buName] = (buMap[item.buName] || 0) + item.quantity;
      }
    });

    return Object.entries(buMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));
  }, [filteredApprovals]);

  const partsInSelectedBUData = useMemo(() => {
    const targetBU = drilldownBU || (topBUsChartData[0]?.name || '');
    if (!targetBU) return { targetBU: '', data: [] };

    const pMap = {};
    filteredApprovals.forEach((item) => {
      if (item.buName.toLowerCase() === targetBU.toLowerCase() && item.partCode !== 'N/A' && item.partCode !== '-') {
        pMap[item.partCode] = (pMap[item.partCode] || 0) + item.quantity;
      }
    });

    const chartData = Object.entries(pMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({
        name: code.length > 14 ? `${code.substring(0, 12)}...` : code,
        fullCode: code,
        quantity: count
      }));

    return { targetBU, data: chartData };
  }, [filteredApprovals, drilldownBU, topBUsChartData]);

  const buWiseICSLData = useMemo(() => {
    const buMap = {};
    filteredApprovals.forEach((item) => {
      if (String(item.partTransaction).trim().toUpperCase() === 'ICSL' && item.buName !== '-') {
        buMap[item.buName] = (buMap[item.buName] || 0) + item.quantity;
      }
    });

    return Object.entries(buMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));
  }, [filteredApprovals]);

  const rmrStatusPieData = useMemo(() => {
    let processed = 0;
    let closed = 0;

    filteredApprovals.forEach((item) => {
      const isRMR = String(item.partTransaction).trim().toUpperCase() === 'RMR';
      if (!isRMR) return;

      if (rmrChartBU !== 'All' && item.buName.toLowerCase() !== rmrChartBU.toLowerCase()) return;

      const st = String(item.status).trim().toLowerCase();
      if (st.includes('close')) closed++;
      else processed++;
    });

    const total = processed + closed;
    if (total === 0) return [];

    return [
      { name: 'Processed', value: processed, percent: ((processed / total) * 100).toFixed(1) },
      { name: 'Closed', value: closed, percent: ((closed / total) * 100).toFixed(1) }
    ];
  }, [filteredApprovals, rmrChartBU]);

  const totalPages = Math.max(1, Math.ceil(filteredApprovals.length / pageSize));
  const paginated = useMemo(() => {
    return filteredApprovals.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredApprovals, currentPage, pageSize]);

  const handleSaveRequisition = (updatedRow, index_) => {
    if (typeof setItems !== 'function') return;
    if (index_ !== null && index_ !== undefined) {
      setItems((prev) => (Array.isArray(prev) ? prev.map((item) => (item.index_ === index_ ? { ...item, row: updatedRow } : item)) : []));
    } else {
      const newEntry = { index_: safeItems.length + 2, row: updatedRow };
      setItems((prev) => (Array.isArray(prev) ? [newEntry, ...prev] : [newEntry]));
    }
    setModalState({ isOpen: false, item: null, isAdd: false });
  };

  const resetFilters = () => {
    setSelectedStatus([]);
    setSelectedBUs([]);
    setFromDateStr('');
    setToDateStr('');
    setSearch('');
    setCurrentPage(1);
  };

  const RMR_COLORS = ['#a855f7', '#10b981'];

  return (
    <div className="space-y-6">
      {/* HEADER & NEW REQUISITION BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            Non-Commercial Spare Approvals
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-400">
            Requisition workflow & approval tracking
          </p>
        </div>

        <button
          onClick={() => setModalState({ isOpen: true, item: null, isAdd: true })}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:opacity-95 text-white text-xs font-bold shadow-[0_0_20px_rgba(192,38,211,0.4)] transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Requisition</span>
        </button>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 relative z-10">
        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-purple-500/10 via-slate-900/70 to-pink-500/10 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]' 
            : 'bg-gradient-to-br from-purple-50/80 via-white/80 to-pink-50/80 border-purple-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-[11px] sm:text-xs font-bold text-slate-400">
            <span>TOTAL ORDERS</span>
            <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black font-mono">
            {metrics.total.toLocaleString()}
          </div>
          <p className="text-[9px] text-slate-400 mt-1">Logged requisitions</p>
        </div>

        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-emerald-500/10 via-slate-900/70 to-teal-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
            : 'bg-gradient-to-br from-emerald-50/80 via-white/80 to-teal-50/80 border-emerald-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-[11px] sm:text-xs font-bold text-emerald-400">
            <span>APPROVED</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black font-mono text-emerald-400">
            {metrics.approved.toLocaleString()}
          </div>
          <p className="text-[9px] text-slate-400 mt-1">Requisitions approved</p>
        </div>

        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-amber-500/10 via-slate-900/70 to-orange-500/10 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
            : 'bg-gradient-to-br from-amber-50/80 via-white/80 to-orange-50/80 border-amber-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-[11px] sm:text-xs font-bold text-amber-400">
            <span>PENDING</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black font-mono text-amber-400">
            {metrics.pending.toLocaleString()}
          </div>
          <p className="text-[9px] text-slate-400 mt-1">Awaiting approval</p>
        </div>

        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-blue-500/10 via-slate-900/70 to-cyan-500/10 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]' 
            : 'bg-gradient-to-br from-blue-50/80 via-white/80 to-cyan-50/80 border-blue-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-[11px] sm:text-xs font-bold text-blue-400">
            <span>ACCUMULATED VALUE</span>
            <IndianRupee className="w-3.5 h-3.5" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black font-mono text-blue-400">
            ₹{metrics.totalAccPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[9px] text-slate-400 mt-1">Sum of line prices</p>
        </div>

        <div className={`p-4 rounded-3xl border col-span-2 lg:col-span-1 backdrop-blur-xl transition hover:scale-[1.02] ${
          isDark 
            ? 'bg-gradient-to-br from-fuchsia-500/10 via-slate-900/70 to-pink-500/10 border-fuchsia-500/30 shadow-[0_0_20px_rgba(217,70,239,0.2)]' 
            : 'bg-gradient-to-br from-fuchsia-50/80 via-white/80 to-pink-50/80 border-fuchsia-200 shadow-md'
        }`}>
          <div className="flex justify-between items-center text-[11px] sm:text-xs font-bold text-fuchsia-400">
            <span>TOP PART UTILISED</span>
            <Wrench className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1.5">
            <h4 className="text-xs sm:text-sm font-extrabold font-mono text-slate-100 truncate" title={metrics.topPart?.code}>
              {metrics.topPart ? metrics.topPart.code : 'N/A'}
            </h4>
            <div className="text-[10px] font-bold text-slate-400 mt-1 flex justify-between">
              <span>Qty: <strong className="text-purple-400 font-mono">{metrics.topPart?.qty || 0}u</strong></span>
              <span>Cost: <strong className="text-emerald-400 font-mono">₹{(metrics.topPart?.cost || 0).toLocaleString()}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER CRITERIA (COLLAPSIBLE) */}
      <div className={`p-4 rounded-3xl border backdrop-blur-2xl shadow-xl relative z-40 transition-all duration-300 ${
        isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200/90'
      }`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowFilters(prev => !prev)}
            className="flex items-center gap-2 cursor-pointer group select-none"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-purple-400 transition-colors">
              Filter Criteria
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
              (selectedStatus.length > 0 || selectedBUs.length > 0 || fromDateStr || toDateStr)
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30' 
                : 'bg-white/10 text-slate-400'
            }`}>
              {showFilters ? 'Hide' : 'Show'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={resetFilters}
            className="text-xs text-rose-500 hover:text-rose-600 hover:underline flex items-center gap-1 font-bold cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4 animate-in fade-in duration-200">
            <MultiSelectDropdown
              label="Business Unit (BU)"
              options={allBUs}
              selected={selectedBUs}
              onChange={(vals) => { setSelectedBUs(vals); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All BUs"
            />

            <MultiSelectDropdown
              label="Approval Status"
              options={allStatuses}
              selected={selectedStatus}
              onChange={(vals) => { setSelectedStatus(vals); setCurrentPage(1); }}
              isDark={isDark}
              placeholder="All Statuses"
            />

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                From Date {fromDateStr && <span className="text-purple-400 font-mono">({safeFormatDate(fromDateStr)})</span>}
              </label>
              <input
                type="date"
                value={safeToISODateInput(fromDateStr)}
                onChange={(e) => {
                  if (!e.target.value) setFromDateStr('');
                  else {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setFromDateStr(safeFormatDate(new Date(y, m - 1, d)));
                  }
                  setCurrentPage(1);
                }}
                className={`w-full min-h-[42px] text-xs px-3 py-2 rounded-2xl border font-mono transition cursor-pointer backdrop-blur-md ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-200 [color-scheme:dark]' : 'bg-white/80 border-slate-200 text-slate-800'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                To Date {toDateStr && <span className="text-purple-400 font-mono">({safeFormatDate(toDateStr)})</span>}
              </label>
              <input
                type="date"
                value={safeToISODateInput(toDateStr)}
                onChange={(e) => {
                  if (!e.target.value) setToDateStr('');
                  else {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setToDateStr(safeFormatDate(new Date(y, m - 1, d)));
                  }
                  setCurrentPage(1);
                }}
                className={`w-full min-h-[42px] text-xs px-3 py-2 rounded-2xl border font-mono transition cursor-pointer backdrop-blur-md ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-200 [color-scheme:dark]' : 'bg-white/80 border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
        <div className={`p-4 rounded-3xl border min-w-0 backdrop-blur-xl shadow-lg ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="mb-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-purple-400" /> Top 5 Parts
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Top spare part codes across requisitions</p>
          </div>

          <div className="w-full h-[210px] sm:h-[230px]">
            {topPartsChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No spare records</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPartsChartData} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155/30' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [`${val} units`, item?.payload?.fullCode || '']}
                    contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '1rem', backdropFilter: 'blur(12px)' }}
                  />
                  <Bar dataKey="quantity" fill="#a855f7" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#e9d5ff" : "#7e22ce"} fontSize={10} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`p-4 rounded-3xl border min-w-0 backdrop-blur-xl shadow-lg ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-400" /> Top 5 BUs
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Click any bar to drill down into BU parts</p>
            </div>
            {drilldownBU && (
              <button onClick={() => setDrilldownBU('')} className="text-xs text-blue-400 hover:underline cursor-pointer font-bold">
                Reset BU
              </button>
            )}
          </div>

          <div className="w-full h-[210px] sm:h-[230px]">
            {topBUsChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No BU records found</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topBUsChartData}
                  margin={{ top: 16, right: 10, left: -20, bottom: 20 }}
                  onClick={(state) => {
                    if (state?.activePayload?.[0]?.payload?.name) {
                      setDrilldownBU(state.activePayload[0].payload.name);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155/30' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val) => [`${val} units (Click to drill down)`, 'Consumption']}
                    contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '1rem', backdropFilter: 'blur(12px)' }}
                  />
                  <Bar dataKey="total" fill="#38bdf8" radius={[6, 6, 0, 0]} className="cursor-pointer">
                    <LabelList dataKey="total" position="top" fill={isDark ? "#bae6fd" : "#0284c7"} fontSize={10} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
        <div className={`p-4 rounded-3xl border min-w-0 backdrop-blur-xl shadow-lg ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 truncate">
                Parts in: <strong className="text-cyan-400">{partsInSelectedBUData.targetBU || 'Select BU'}</strong>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Top parts consumed in this BU</p>
            </div>
            <select
              value={partsInSelectedBUData.targetBU}
              onChange={(e) => setDrilldownBU(e.target.value)}
              className={`text-xs px-2.5 py-1.5 rounded-xl border font-bold cursor-pointer backdrop-blur-md ${
                isDark ? 'bg-slate-800/70 border-white/10 text-slate-200' : 'bg-white/80 border-slate-200 text-slate-800'
              }`}
            >
              <option value="" disabled>Change BU</option>
              {allBUs.map((bu) => <option key={bu} value={bu}>{bu}</option>)}
            </select>
          </div>

          <div className="w-full h-[200px] sm:h-[210px]">
            {partsInSelectedBUData.data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No parts in this BU</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partsInSelectedBUData.data} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155/30' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [`${val} units`, item?.payload?.fullCode || '']}
                    contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '1rem', backdropFilter: 'blur(12px)' }}
                  />
                  <Bar dataKey="quantity" fill="#2dd4bf" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#99f6e4" : "#0f766e"} fontSize={10} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`p-4 rounded-3xl border min-w-0 backdrop-blur-xl shadow-lg ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="mb-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              BU Wise ICSL Used
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Part Transaction = "ICSL"</p>
          </div>

          <div className="w-full h-[200px] sm:h-[210px]">
            {buWiseICSLData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No ICSL records</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buWiseICSLData} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155/30' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val) => [`${val} units ICSL`, 'ICSL Volume']}
                    contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '1rem', backdropFilter: 'blur(12px)' }}
                  />
                  <Bar dataKey="total" fill="#fbbf24" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="total" position="top" fill={isDark ? "#fef08a" : "#b45309"} fontSize={10} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`p-4 rounded-3xl border min-w-0 flex flex-col justify-between backdrop-blur-xl shadow-lg ${
          isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                RMR Breakdown
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Part Transaction = "RMR"</p>
            </div>
            <select
              value={rmrChartBU}
              onChange={(e) => setRmrChartBU(e.target.value)}
              className={`text-xs px-2.5 py-1.5 rounded-xl border font-bold cursor-pointer backdrop-blur-md ${
                isDark ? 'bg-slate-800/70 border-white/10 text-slate-200' : 'bg-white/80 border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">Select BU</option>
              {allBUs.map((bu) => <option key={bu} value={bu}>{bu}</option>)}
            </select>
          </div>

          <div className="w-full h-[200px] sm:h-[210px]">
            {rmrStatusPieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No RMR data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(val, name, item) => [`${val} orders (${item.payload.percent}%)`, name]}
                    contentStyle={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '1rem', backdropFilter: 'blur(12px)' }}
                  />
                  <Pie
                    data={rmrStatusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    cy="55%"
                    innerRadius={10}
                    outerRadius={80}
                    paddingAngle={1}
                  >
                    {rmrStatusPieData.map((entry, index) => (
                      <Cell key={`rmr-${index}`} fill={RMR_COLORS[index % RMR_COLORS.length]} stroke={isDark ? '#060814' : '#ffffff'} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    formatter={(value, entry) => (
                      <span className={isDark ? "text-slate-300 text-[10px]" : "text-slate-700 text-[10px]"}>
                        {value}: <strong className="font-mono text-purple-400">{entry.payload.value}</strong>
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* REQUISITION WORKSPACE */}
      <div className={`rounded-3xl border overflow-hidden backdrop-blur-2xl shadow-xl relative z-10 ${
        isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200/90'
      }`}>
        <div className="p-3.5 sm:p-4 border-b flex flex-wrap items-center justify-between gap-3 border-inherit">
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Req No, BU, Part Code, Task No..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className={`text-xs pl-9 pr-3.5 py-2.5 rounded-2xl border w-full focus:outline-none transition backdrop-blur-md ${
                  isDark ? 'bg-slate-800/60 border-white/10 text-slate-100 focus:border-purple-400' : 'bg-white/80 border-slate-200 text-slate-900 focus:border-purple-500'
                }`}
              />
            </div>

            <div className={`flex items-center p-0.5 rounded-2xl border backdrop-blur-md ${
              isDark ? 'bg-slate-800/60 border-white/10' : 'bg-slate-100/80 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Table
              </button>
            </div>
          </div>

          <span className="text-[11px] text-slate-400 font-medium">
            Page {currentPage} of {totalPages} ({filteredApprovals.length} records • Latest First)
          </span>
        </div>

        {viewMode === 'grid' ? (
          <div className="p-3 sm:p-4 max-h-[700px] overflow-y-auto">
            {paginated.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No matching requisitions found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {paginated.map((item) => (
                  <div
                    key={item.index_}
                    onClick={() => setModalState({ isOpen: true, item, isAdd: false })}
                    className={`rounded-2xl border p-4 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-xl cursor-pointer hover:border-purple-400/60 hover:-translate-y-0.5 active:scale-[0.98] backdrop-blur-md ${
                      isDark ? 'bg-slate-900/60 border-white/10 hover:bg-slate-800/60' : 'bg-white/70 border-slate-200/80 hover:bg-white/95'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-500 border border-purple-500/30">
                          #{item.reqNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(item.approvalStatus)}`}>
                          {item.approvalStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-semibold text-slate-500 truncate">
                          BU: <strong className="text-purple">{item.buName}</strong>
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${getTransactionBadge(item.partTransaction)}`}>
                          {item.partTransaction}
                        </span>
                      </div>

                      <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 backdrop-blur-sm ${
                        isDark ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50/80 border-slate-200'
                      }`}>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Part Code:</span>
                          <span className="font-mono font-bold truncate max-w-[140px] text-slate-500" title={item.partCode}>
                            {item.partCode}
                          </span>
                        </div>

                        <div className="flex justify-between items-start text-[11px] gap-2 pt-0.5 border-t border-dashed border-inherit">
                          <span className="text-slate-400 shrink-0">Part Desc:</span>
                          <span className="text-right wrap max-w-[140px] font-medium text-slate-500" title={item.partDescription}>
                            {item.partDescription}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Task No:</span>
                          <span className="font-mono font-semibold text-slate-500" title={item.taskNo}>
                            {item.taskNo}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Tax Category:</span>
                          <span className="text-right wrap max-w-[130px] font-medium text-slate-500" title={item.taxCategory}>
                            {item.taxCategory}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-inherit">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Qty:</span>
                            <span className="font-bold font-mono text-slate-500">{item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Price:</span>
                            <span className="font-bold text-purple-500 font-mono">
                              ₹{item.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 mt-2.5 border-t border-inherit flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-mono">{item.reqDate}</span>
                      <span className="font-bold text-purple-500 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-400/30">
                        TL: {item.taskOwner}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className={`uppercase text-[10px] tracking-wider border-b border-inherit sticky top-0 backdrop-blur-xl ${
                isDark ? 'bg-slate-900/90 text-slate-200' : 'bg-slate-100/90 text-slate-700 font-bold'
              }`}>
                <tr>
                  <th className="py-3 px-3.5 whitespace-nowrap">Req No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Req Date</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">BU Name</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Part Code</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Tax Category</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Transaction</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Qty</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Price</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Approval</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">TL Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  paginated.map((row) => (
                    <tr
                      key={row.index_}
                      onClick={() => setModalState({ isOpen: true, item: row, isAdd: false })}
                      className="hover:bg-white/5 cursor-pointer transition"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-purple-500 whitespace-nowrap">#{row.reqNumber}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-500 whitespace-nowrap">{row.reqDate}</td>
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-500">{row.buName}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-500 whitespace-nowrap">{row.taskNo}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-500 whitespace-nowrap font-semibold">{row.partCode}</td>
                      <td className="py-3 px-3.5 max-w-[150px] text-slate-500 truncate" title={row.taxCategory}>{row.taxCategory}</td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getTransactionBadge(row.partTransaction)}`}>
                          {row.partTransaction}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap">{row.quantity}</td>
                      <td className="py-3 px-3.5 font-semibold text-purple-500 whitespace-nowrap">₹{row.price.toLocaleString()}</td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(row.approvalStatus)}`}>
                          {row.approvalStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap font-bold text-purple-500">{row.taskOwner}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 border-t border-inherit flex items-center justify-between text-xs text-slate-400">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="px-3.5 py-1.5 min-h-[36px] rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-bold transition"
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-3.5 py-1.5 min-h-[36px] rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-bold transition"
          >
            Next
          </button>
        </div>
      </div>

      {modalState.isOpen && (
        <Requisition19ColModal
          item={modalState.item}
          isAdd={modalState.isAdd}
          nextReqNumber={modalState.isAdd ? nextReqNumber : (modalState.item?.reqNumber || '')}
          isDark={isDark}
          onClose={() => setModalState({ isOpen: false, item: null, isAdd: false })}
          onSave={handleSaveRequisition}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*         MODAL: ROBUST 19-COLUMN ENTRY & EDIT FORM (MOBILE OPTIMIZED)        */
/* -------------------------------------------------------------------------- */
function Requisition19ColModal({ item, isAdd, nextReqNumber, isDark, onClose, onSave }) {
  const initial = useMemo(() => {
    if (item && Array.isArray(item.rawRow)) return item.rawRow;
    if (item && item.rawRow && typeof item.rawRow === 'object') return Object.values(item.rawRow);
    return new Array(19).fill('');
  }, [item]);

  const presetBUs = typeof PRESET_BU_LIST !== 'undefined' ? PRESET_BU_LIST : ['Ahmedabad', 'Bangalore', 'Chennai', 'Delhi', 'Hyderabad', 'Kolkata', 'Mumbai', 'Pune'];
  const presetTLMap = typeof PRESET_BU_TO_TL !== 'undefined' ? PRESET_BU_TO_TL : {};
  const presetTransTypes = typeof PRESET_TRANSACTION_TYPES !== 'undefined' ? PRESET_TRANSACTION_TYPES : ['BOM_BU_Transfer_Permanent_Ord'];
  const presetTaxMap = typeof TRANSACTION_TYPE_TO_TAX !== 'undefined' ? TRANSACTION_TYPE_TO_TAX : {};
  const presetOrderedBy = typeof PRESET_ORDERED_BY !== 'undefined' ? PRESET_ORDERED_BY : ['CSC', 'Direct', 'Branch'];
  const presetPartTransactions = typeof PRESET_PART_TRANSACTIONS !== 'undefined' ? PRESET_PART_TRANSACTIONS : ['RMR', 'ICSL', 'ST', 'CSC WARRANTY', 'PBS'];

  const defaultBU = initial[4] || presetBUs[0] || 'Ahmedabad';
  const defaultTaskOwner = initial[5] || presetTLMap[defaultBU] || 'AKB';
  const defaultTransType = initial[13] || presetTransTypes[0] || 'BOM_BU_Transfer_Permanent_Ord';
  const defaultTax = initial[14] || presetTaxMap[defaultTransType] || 'Bom:Insterstate 18%';

  const [formData, setFormData] = useState({
    reqNumber: isAdd ? String(nextReqNumber) : (initial[0] !== undefined && initial[0] !== '' ? String(initial[0]) : String(nextReqNumber)),
    date: initial[1] ? safeFormatDate(initial[1]) : safeFormatDate(new Date()),
    orderNumber: initial[2] !== undefined ? String(initial[2]) : '',
    requesterComment: initial[3] !== undefined ? String(initial[3]) : '',
    buName: defaultBU,
    taskOwner: defaultTaskOwner,
    partCode: initial[6] !== undefined ? String(initial[6]) : '',
    partDescription: initial[7] !== undefined ? String(initial[7]) : '',
    quantity: initial[8] !== undefined && initial[8] !== '' ? String(initial[8]) : '1',
    price: initial[9] !== undefined && initial[9] !== '' ? String(initial[9]) : '0',
    taskNo: initial[10] !== undefined ? String(initial[10]) : '',
    orderedBy: initial[11] || presetOrderedBy[0] || 'CSC',
    partTransaction: initial[12] || presetPartTransactions[0] || 'RMR',
    transactionType: defaultTransType,
    taxCategory: defaultTax,
    approvalStatus: initial[15] || (isAdd ? 'Pending' : 'Approved'),
    status: initial[16] || 'Processed',
    statusDate: initial[17] ? safeFormatDate(initial[17]) : safeFormatDate(new Date()),
    remarks: initial[18] !== undefined ? String(initial[18]) : ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'buName') updated.taskOwner = presetTLMap[value] || 'AKB';
      if (name === 'transactionType') updated.taxCategory = presetTaxMap[value] || 'Bom:Insterstate 18%';
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const rowArray = [
      formData.reqNumber,
      safeFormatDate(formData.date),
      formData.orderNumber,
      formData.requesterComment,
      formData.buName,
      formData.taskOwner,
      formData.partCode,
      formData.partDescription,
      formData.quantity,
      formData.price,
      formData.taskNo,
      formData.orderedBy,
      formData.partTransaction,
      formData.transactionType,
      formData.taxCategory,
      formData.approvalStatus,
      formData.status,
      safeFormatDate(formData.statusDate),
      formData.remarks
    ];
    onSave(rowArray, item ? item.index_ : null);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-2xl max-h-[90vh] sm:max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl backdrop-blur-2xl ${
        isDark ? 'bg-slate-900/95 border-white/15 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]' : 'bg-white/95 border-slate-200 text-slate-900'
      }`}>
        <div className="p-4 border-b flex items-center justify-between border-inherit">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs sm:text-sm px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
              #{formData.reqNumber}
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-white">
              {isAdd ? 'Create Requisition' : `Edit Requisition #${formData.reqNumber}`}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 cursor-pointer text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 sm:space-y-4 text-xs flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div>
              <label className="block font-bold text-slate-400 mb-1">Req No</label>
              <input
                type="text"
                name="reqNumber"
                value={formData.reqNumber}
                onChange={handleChange}
                placeholder="Req Number"
                required
                className={`w-full min-h-[40px] px-3 py-2 rounded-2xl border font-mono font-bold backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-500 mb-1">Req Date</label>
              <input
                type="text"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-3 py-2 rounded-2xl border font-mono backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-1">Order Number</label>
              <input
                type="text"
                name="orderNumber"
                value={formData.orderNumber}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-3 py-2 rounded-2xl border font-mono backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
            
          </div>
          
          <div>
            <label className="block font-bold text-slate-400 mb-1">Requester Comment</label>
            <textarea
              name="requesterComment"
              rows={2}
              value={formData.requesterComment}
              onChange={handleChange}
              className={`w-full px-3 py-2 rounded-2xl border backdrop-blur-sm ${
                isDark ? 'bg-slate-800/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 p-3 rounded-2xl border border-white/5 bg-white/5">
            <div>
              <label className="block font-bold text-slate-400 mb-1">BU Name</label>
              <select
                name="buName"
                value={formData.buName}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-2.5 py-2 rounded-2xl border font-bold backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/70 border-white/10 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                {presetBUs.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-1">Task Owner (TL)</label>
              <input
                type="text"
                name="taskOwner"
                value={formData.taskOwner}
                readOnly
                className={`w-full min-h-[40px] px-2.5 py-2 rounded-2xl border font-extrabold cursor-not-allowed ${
                  isDark ? 'bg-slate-950/70 border-white/5 text-purple-400' : 'bg-slate-100 border-slate-200 text-purple-700'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div>
              <label className="block font-bold text-slate-400 mb-1">Part Code</label>
              <input
                type="text"
                name="partCode"
                value={formData.partCode}
                onChange={handleChange}
                placeholder="Exact Part Code"
                className={`w-full min-h-[40px] px-3 py-2 rounded-2xl border font-mono backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-400 mb-1">Part Description</label>
              <input
                type="text"
                name="partDescription"
                value={formData.partDescription}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-3 py-2 rounded-2xl border backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
            <div>
              <label className="block font-bold text-slate-400 mb-1">Quantity</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-3 py-2 rounded-2xl border font-bold backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-1">Price</label>
              <input
                type="number"
                step="any"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-3 py-2 rounded-2xl border font-bold text-emerald-400 backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/60 border-white/10' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-1">Task No</label>
              <input
                type="text"
                name="taskNo"
                value={formData.taskNo}
                onChange={handleChange}
                placeholder="Exact Task No"
                className={`w-full min-h-[40px] px-3 py-2 rounded-2xl border font-mono backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-1">Ordered By</label>
              <select
                name="orderedBy"
                value={formData.orderedBy}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-2.5 py-2 rounded-2xl border font-bold backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/70 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                {presetOrderedBy.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-1">Transaction</label>
              <select
                name="partTransaction"
                value={formData.partTransaction}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-2.5 py-2 rounded-2xl border font-bold backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/70 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                {presetPartTransactions.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 p-3 rounded-2xl border border-white/5 bg-white/5">
            <div>
              <label className="block font-bold text-slate-400 mb-1">Transaction Type</label>
              <select
                name="transactionType"
                value={formData.transactionType}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-2.5 py-2 rounded-2xl border font-bold backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/70 border-white/10 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                {presetTransTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-1">Tax Category</label>
              <input
                type="text"
                name="taxCategory"
                value={formData.taxCategory}
                readOnly
                className={`w-full min-h-[40px] px-2.5 py-2 rounded-2xl border font-bold cursor-not-allowed ${
                  isDark ? 'bg-slate-950/70 border-white/5 text-emerald-400' : 'bg-slate-100 border-slate-200 text-emerald-700'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div>
              <label className="block font-bold text-slate-400 mb-1">Approval Status</label>
              <select
                name="approvalStatus"
                value={formData.approvalStatus}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-2.5 py-2 rounded-2xl border font-bold ${
                  isDark ? 'bg-slate-800/70 border-white/10 text-emerald-400' : 'bg-slate-50 border-slate-300 text-emerald-700'
                }`}
              >
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="On Hold">On Hold</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-2.5 py-2 rounded-2xl border ${
                  isDark ? 'bg-slate-800/70 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="Processed">Processed</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-1">Status Date</label>
              <input
                type="text"
                name="statusDate"
                value={formData.statusDate}
                onChange={handleChange}
                className={`w-full min-h-[40px] px-3 py-2 rounded-2xl border font-mono backdrop-blur-sm ${
                  isDark ? 'bg-slate-800/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-400 mb-1">Remarks</label>
            <textarea
              name="remarks"
              rows={2}
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Internal remarks..."
              className={`w-full px-3 py-2 rounded-2xl border backdrop-blur-sm ${
                isDark ? 'bg-slate-800/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            />
          </div>

          <div className="pt-3 border-t flex flex-col-reverse sm:flex-row justify-end gap-2 border-inherit">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] rounded-2xl border border-inherit text-xs font-bold cursor-pointer hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:opacity-95 text-white font-bold text-xs shadow-[0_0_20px_rgba(192,38,211,0.4)] transition cursor-pointer"
            >
              Save Requisition
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}