import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Your live Google Apps Script Web App URL
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzvXkNXGgSnHpBKl1BsfTxhpV70ycFc0FgOyhFtDjyL-WeJzfCSFiY63osB8Q8WDeAS/exec";

function DashboardWrapper() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch data when the app loads
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch(WEB_APP_URL);
      const result = await response.json();
      if (result.status === 'success') {
        setData(result.data);
      } else {
        console.error("Error fetching data:", result.message);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Update a row
  const updateItem = async (index, updatedRow) => {
    // 1. Update UI instantly (Optimistic update)
    setData(prev => prev.map(item => item.index_ === index ? { ...item, row: updatedRow } : item));
    
    // 2. Send to Google Sheets quietly in the background
    await fetch(WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'update', index_: index, row: updatedRow }),
    });
  };

  // Insert a new row
  const insertItem = async (index, newRow) => {
    // 1. Update UI instantly
    const newItem = { index_: data.length + 999, row: newRow }; 
    setData(prev => [...prev, newItem]);
    
    // 2. Send to Google Sheets
    await fetch(WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'insert', index_: index, row: newRow }),
    });
    
    // 3. Refresh to get the true row index from Google
    fetchData(); 
  };

  // Delete a row
  const deleteItem = async (index) => {
    // 1. Update UI instantly
    setData(prev => prev.filter(item => item.index_ !== index));
    
    // 2. Send to Google Sheets
    await fetch(WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', index_: index }),
    });
  };

  // Show a loading screen while fetching from Google Sheets
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-600 font-semibold text-sm">Loading Service Operations Data...</p>
        </div>
      </div>
    );
  }

  // Once data is loaded, render the dashboard and pass the tools to it!
  return (
    <App 
      data={data} 
      updateItem={updateItem} 
      deleteItem={deleteItem} 
      insertItem={insertItem} 
    />
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DashboardWrapper />
  </StrictMode>,
)