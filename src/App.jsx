import React, { useState, useEffect } from 'react';
import { User, Search, Filter, Plus, LogOut, Users, Upload, Download, Eye, Edit2, Save, X, ChevronDown, Calendar, DollarSign, MapPin, FileText, Clock, TrendingUp } from 'lucide-react';

// Persistent storage wrapper
const storage = {
  async get(key) {
    try {
      const result = await window.storage.get(key);
      return result ? JSON.parse(result.value) : null;
    } catch (e) {
      console.log(`Key ${key} not found`);
      return null;
    }
  },
  async set(key, value) {
    try {
      await window.storage.set(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage error:', e);
    }
  },
  async list(prefix) {
    try {
      const result = await window.storage.list(prefix);
      return result ? result.keys : [];
    } catch (e) {
      return [];
    }
  }
};

// Initial sample data (will be replaced with real data)
const INITIAL_LEADS = [
  {
    id: "LEAD_00001",
    caseNumber: "2024-004542-CA-01",
    county: "Miami-Dade",
    leadType: "Future Auction",
    auctionDate: "02/17/2026",
    propertyAddress: "527 E DI LIDO DR MIAMI BEACH",
    propertyCity: "Miami Beach",
    propertyZip: "33139",
    assessedValue: "$8,631,405",
    judgmentAmount: "$5,671,374",
    soldAmount: "",
    surplus: "",
    defendants: "527 Edilido LLC; Siffin, Mark A",
    plaintiffs: "So-Cal Capital, Inc.",
    parcelId: "02-3232-011-0620",
    caseUrl: "https://miami-dade.realforeclose.com",
    zillowUrl: "http://www.zillow.com/homes/map/527-E-DI-LIDO-DR,MIAMI-BEACH,33139,fl_rb/",
    propertyAppraiserUrl: "https://www.miamidade.gov/Apps/PA/propertysearch/",
    status: "New",
    assignedTo: null,
    notes: [],
    createdAt: "2026-02-17T12:00:00Z",
    lastModified: "2026-02-17T12:00:00Z"
  }
];

const INITIAL_USERS = [
  { id: 'admin', username: 'ReboundCapitalGroup', password: 'RCG123', role: 'admin', name: 'Admin User' },
  { id: 'user1', username: 'agent1', password: 'agent123', role: 'user', name: 'Agent One' }
];

export default function TaxDeedCRM() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [countyFilter, setCountyFilter] = useState('all');
  const [editingNote, setEditingNote] = useState('');
  const [view, setView] = useState('login'); // login, dashboard, lead-detail, admin
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [uploadData, setUploadData] = useState('');
  const [loading, setLoading] = useState(true);

  // Initialize data from persistent storage
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      
      // Load users
      const storedUsers = await storage.get('crm_users');
      if (storedUsers) {
        setUsers(storedUsers);
      } else {
        await storage.set('crm_users', INITIAL_USERS);
      }
      
      // Load leads
      const storedLeads = await storage.get('crm_leads');
      if (storedLeads) {
        setLeads(storedLeads);
        setFilteredLeads(storedLeads);
      } else {
        await storage.set('crm_leads', INITIAL_LEADS);
        setLeads(INITIAL_LEADS);
        setFilteredLeads(INITIAL_LEADS);
      }
      
      setLoading(false);
    };
    
    initData();
  }, []);

  // Save leads when they change
  useEffect(() => {
    if (leads.length > 0) {
      storage.set('crm_leads', leads);
    }
  }, [leads]);

  // Filter leads
  useEffect(() => {
    let filtered = leads;
    
    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.county.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.defendants.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(lead => lead.leadType === typeFilter);
    }
    
    if (countyFilter !== 'all') {
      filtered = filtered.filter(lead => lead.county === countyFilter);
    }
    
    // Non-admins only see assigned leads
    if (currentUser && currentUser.role !== 'admin') {
      filtered = filtered.filter(lead => lead.assignedTo === currentUser.id);
    }
    
    setFilteredLeads(filtered);
  }, [searchTerm, statusFilter, typeFilter, countyFilter, leads, currentUser]);

  const handleLogin = (e) => {
    e.preventDefault();
    const user = users.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (user) {
      setCurrentUser(user);
      setView('dashboard');
      setLoginForm({ username: '', password: '' });
    } else {
      alert('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
    setSelectedLead(null);
  };

  const updateLeadStatus = (leadId, newStatus) => {
    setLeads(leads.map(lead =>
      lead.id === leadId ? { ...lead, status: newStatus, lastModified: new Date().toISOString() } : lead
    ));
  };

  const addNote = (leadId, noteText) => {
    if (!noteText.trim()) return;
    
    const newNote = {
      id: Date.now(),
      text: noteText,
      author: currentUser.name,
      createdAt: new Date().toISOString()
    };
    
    setLeads(leads.map(lead =>
      lead.id === leadId ? { 
        ...lead, 
        notes: [...lead.notes, newNote],
        lastModified: new Date().toISOString()
      } : lead
    ));
    
    setEditingNote('');
  };

  const assignLead = (leadId, userId) => {
    setLeads(leads.map(lead =>
      lead.id === leadId ? { ...lead, assignedTo: userId, lastModified: new Date().toISOString() } : lead
    ));
  };

  const uploadNewLeads = () => {
    if (!uploadData.trim()) {
      alert('Please paste lead data in JSON format');
      return;
    }
    
    try {
      const newLeads = JSON.parse(uploadData);
      const mergedLeads = [...leads];
      
      newLeads.forEach(newLead => {
        const existingIndex = mergedLeads.findIndex(l => l.caseNumber === newLead.caseNumber);
        if (existingIndex >= 0) {
          // Update existing lead
          mergedLeads[existingIndex] = { ...mergedLeads[existingIndex], ...newLead };
        } else {
          // Add new lead
          mergedLeads.push(newLead);
        }
      });
      
      setLeads(mergedLeads);
      setUploadData('');
      alert(`Successfully uploaded ${newLeads.length} leads!`);
    } catch (e) {
      alert('Invalid JSON format. Please check your data.');
    }
  };

  const exportLeads = () => {
    const dataStr = JSON.stringify(filteredLeads, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const getStats = () => {
    const total = leads.length;
    const newLeads = leads.filter(l => l.status === 'New').length;
    const contacted = leads.filter(l => l.status === 'Contacted').length;
    const interested = leads.filter(l => l.status === 'Interested').length;
    const surplus = leads.filter(l => l.leadType === 'Surplus').length;
    const future = leads.filter(l => l.leadType === 'Future Auction').length;
    
    return { total, newLeads, contacted, interested, surplus, future };
  };

  const stats = getStats();
  const counties = [...new Set(leads.map(l => l.county))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-amber-400 text-xl font-semibold">Loading CRM...</div>
      </div>
    );
  }

  // LOGIN VIEW
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl mb-4">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Rebound Capital Group CRM</h1>
              <p className="text-slate-400">Secure lead management system</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  placeholder="Enter username"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  placeholder="Enter password"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-amber-500/50"
              >
                Sign In
              </button>
            </form>
            
            
          </div>
        </div>
      </div>
    );
  }

  // ADMIN VIEW
  if (view === 'admin' && currentUser?.role === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setView('dashboard')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ← Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-slate-400">{currentUser.name}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Upload Section */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <Upload className="w-5 h-5 mr-2 text-amber-400" />
              Upload New Leads
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              Paste scraped lead data in JSON format. Existing leads will be updated, new leads will be added.
            </p>
            <textarea
              value={uploadData}
              onChange={(e) => setUploadData(e.target.value)}
              className="w-full h-64 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              placeholder='[{"id": "LEAD_00001", "caseNumber": "...", ...}]'
            />
            <button
              onClick={uploadNewLeads}
              className="mt-4 px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-orange-700 transition-all"
            >
              Upload Leads
            </button>
          </div>

          {/* User Management */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-amber-400" />
              User Management
            </h2>
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg border border-slate-700/30">
                  <div>
                    <p className="text-white font-medium">{user.name}</p>
                    <p className="text-slate-400 text-sm">@{user.username} • {user.role}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {user.role.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LEAD DETAIL VIEW
  if (view === 'lead-detail' && selectedLead) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setView('dashboard')}
                className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
              >
                <span>← Back</span>
              </button>
              <div className="flex items-center space-x-4">
                <span className="text-slate-400">{currentUser.name}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Header Card */}
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
                      selectedLead.leadType === 'Surplus' 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {selectedLead.leadType}
                    </span>
                    <h1 className="text-3xl font-bold text-white mb-2">{selectedLead.propertyAddress}</h1>
                    <p className="text-slate-400">{selectedLead.county} County • Case #{selectedLead.caseNumber}</p>
                  </div>
                  <select
                    value={selectedLead.status}
                    onChange={(e) => updateLeadStatus(selectedLead.id, e.target.value)}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-amber-500"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Interested">Interested</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Dead">Dead</option>
                  </select>
                </div>

                {selectedLead.surplus && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-semibold">Surplus Amount</span>
                      <span className="text-2xl font-bold text-emerald-400">{selectedLead.surplus}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Property Details */}
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-amber-400" />
                  Property Details
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Assessed Value</p>
                    <p className="text-white font-semibold">{selectedLead.assessedValue || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Judgment Amount</p>
                    <p className="text-white font-semibold">{selectedLead.judgmentAmount || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Sold Amount</p>
                    <p className="text-white font-semibold">{selectedLead.soldAmount || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Auction Date</p>
                    <p className="text-white font-semibold">{selectedLead.auctionDate}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Parcel ID</p>
                    <p className="text-white font-semibold">{selectedLead.parcelId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">City / Zip</p>
                    <p className="text-white font-semibold">{selectedLead.propertyCity} {selectedLead.propertyZip}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {selectedLead.caseUrl && (
                    <a
                      href={selectedLead.caseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                    >
                      View Case →
                    </a>
                  )}
                  {selectedLead.zillowUrl && (
                    <a
                      href={selectedLead.zillowUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                    >
                      Zillow →
                    </a>
                  )}
                  {selectedLead.propertyAppraiserUrl && (
                    <a
                      href={selectedLead.propertyAppraiserUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                    >
                      Appraiser →
                    </a>
                  )}
                </div>
              </div>

              {/* Parties */}
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Parties</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-slate-400 text-sm mb-2">Defendants</p>
                    <p className="text-white">{selectedLead.defendants}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-2">Plaintiffs</p>
                    <p className="text-white">{selectedLead.plaintiffs}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Assignment */}
              {currentUser.role === 'admin' && (
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Assignment</h3>
                  <select
                    value={selectedLead.assignedTo || ''}
                    onChange={(e) => assignLead(selectedLead.id, e.target.value || null)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Unassigned</option>
                    {users.filter(u => u.role === 'user').map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Activity & Notes</h3>
                
                <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                  {selectedLead.notes.map(note => (
                    <div key={note.id} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/30">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-slate-400 text-xs font-medium">{note.author}</span>
                        <span className="text-slate-500 text-xs">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-white text-sm">{note.text}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <textarea
                    value={editingNote}
                    onChange={(e) => setEditingNote(e.target.value)}
                    placeholder="Add a note..."
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                    rows={3}
                  />
                  <button
                    onClick={() => addNote(selectedLead.id, editingNote)}
                    className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-orange-700 transition-all"
                  >
                    Add Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD VIEW
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Rebound Capital Group CRM</h1>
                  <p className="text-xs text-slate-400">Lead Management</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {currentUser.role === 'admin' && (
                <>
                  <button
                    onClick={() => setView('admin')}
                    className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    <span>Admin</span>
                  </button>
                  <button
                    onClick={exportLeads}
                    className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                </>
              )}
              <div className="flex items-center space-x-3 px-4 py-2 bg-slate-700/50 rounded-lg">
                <User className="w-4 h-4 text-amber-400" />
                <span className="text-white font-medium">{currentUser.name}</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  currentUser.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {currentUser.role.toUpperCase()}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Total Leads</span>
              <FileText className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.total}</p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">New</span>
              <Plus className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-blue-400">{stats.newLeads}</p>
          </div>
          
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Contacted</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-amber-400">{stats.contacted}</p>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Interested</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-400">{stats.interested}</p>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Surplus</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-400">{stats.surplus}</p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Future</span>
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-blue-400">{stats.future}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-slate-900/50 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Interested">Interested</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Dead">Dead</option>
            </select>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-3 bg-slate-900/50 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Types</option>
              <option value="Surplus">Surplus</option>
              <option value="Future Auction">Future Auction</option>
            </select>
            
            <select
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
              className="px-4 py-3 bg-slate-900/50 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Counties</option>
              {counties.map(county => (
                <option key={county} value={county}>{county}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700/50">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Case #</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">County</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Property</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Type</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Date</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Surplus</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, idx) => (
                  <tr
                    key={lead.id}
                    className={`border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors ${
                      idx % 2 === 0 ? 'bg-slate-900/20' : ''
                    }`}
                  >
                    <td className="px-6 py-4 text-white font-mono text-sm">{lead.caseNumber}</td>
                    <td className="px-6 py-4 text-slate-300 text-sm">{lead.county}</td>
                    <td className="px-6 py-4 text-white text-sm max-w-xs truncate">{lead.propertyAddress}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        lead.leadType === 'Surplus' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {lead.leadType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 text-sm">{lead.auctionDate}</td>
                    <td className="px-6 py-4 text-emerald-400 font-semibold text-sm">{lead.surplus || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        lead.status === 'New' ? 'bg-blue-500/20 text-blue-400' :
                        lead.status === 'Contacted' ? 'bg-amber-500/20 text-amber-400' :
                        lead.status === 'Interested' ? 'bg-emerald-500/20 text-emerald-400' :
                        lead.status === 'Not Interested' ? 'bg-slate-500/20 text-slate-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setSelectedLead(lead);
                          setView('lead-detail');
                        }}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredLeads.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400">No leads found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
