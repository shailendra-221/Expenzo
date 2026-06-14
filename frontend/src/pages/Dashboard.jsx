import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function Dashboard() {
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    api.get('/groups').then((res) => setGroups(res.data));
    api.get('/me/summary').then((res) => setSummary(res.data));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/groups', { name: groupName, description: groupDesc });
      setGroupName('');
      setGroupDesc('');
      setShowNewGroup(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h2>Your Groups</h2>
        <button className="btn" onClick={() => setShowNewGroup(true)}>+ New Group</button>
      </div>

      {summary && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="muted">You are owed</div>
            <div className="value positive">₹{summary.totalOwedToYou.toFixed(2)}</div>
          </div>
          <div className="summary-card">
            <div className="muted">You owe</div>
            <div className="value negative">₹{summary.totalYouOwe.toFixed(2)}</div>
          </div>
          <div className="summary-card">
            <div className="muted">Net balance</div>
            <div className={`value ${summary.net >= 0 ? 'positive' : 'negative'}`}>
              ₹{Math.abs(summary.net).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      <div className="group-list">
        {groups.length === 0 && <p className="muted">You're not part of any groups yet.</p>}
        {groups.map((g) => {
          const groupSummary = summary?.perGroup.find((p) => p.group_id === g.id);
          const bal = groupSummary?.balance || 0;
          return (
            <Link to={`/groups/${g.id}`} key={g.id} className="group-card">
              <div className="flex-between">
                <div>
                  <strong>{g.name}</strong>
                  {g.description && <div className="muted">{g.description}</div>}
                </div>
                <div>
                  {bal === 0 && <span className="muted">settled up</span>}
                  {bal > 0 && <span className="positive">you are owed ₹{bal.toFixed(2)}</span>}
                  {bal < 0 && <span className="negative">you owe ₹{Math.abs(bal).toFixed(2)}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {showNewGroup && (
        <div className="modal-overlay" onClick={() => setShowNewGroup(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Group</h3>
            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label>Group name</label>
                <input value={groupName} onChange={(e) => setGroupName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <input value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
              </div>
              {error && <div className="error-text">{error}</div>}
              <div className="flex-between" style={{ gap: 8 }}>
                <button type="button" className="btn secondary" onClick={() => setShowNewGroup(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn" style={{ flex: 1 }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
