import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import SettleUpModal from '../components/SettleUpModal';

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState(null);
  const [tab, setTab] = useState('expenses');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [showSettle, setShowSettle] = useState(false);
  const [settlements, setSettlements] = useState([]);

  const load = () => {
    api.get(`/groups/${id}`).then((res) => setGroup(res.data));
    api.get(`/groups/${id}/expenses`).then((res) => setExpenses(res.data));
    api.get(`/groups/${id}/balances`).then((res) => setBalances(res.data));
    api.get(`/groups/${id}/settlements`).then((res) => setSettlements(res.data));
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    try {
      await api.post(`/groups/${id}/members`, { email: inviteEmail });
      setInviteEmail('');
      setShowInvite(false);
      load();
    } catch (err) {
      setInviteError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await api.delete(`/groups/${id}/members/${userId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${expenseId}`);
    load();
  };

  if (!group) return <div className="container">Loading...</div>;

  const myBalance = balances?.netBalances.find((b) => b.user_id === user.id)?.amount || 0;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0 }}>{group.name}</h2>
          {group.description && <p className="muted" style={{ margin: 0 }}>{group.description}</p>}
        </div>
        <Link to={`/groups/${id}/expenses/new`} className="btn">+ Add Expense</Link>
      </div>

      <div className="card flex-between">
        <div>
          <div className="muted">Your balance in this group</div>
          <div className={myBalance >= 0 ? 'positive' : 'negative'} style={{ fontSize: 22 }}>
            {myBalance === 0 ? 'Settled up' : myBalance > 0
              ? `You are owed ₹${myBalance.toFixed(2)}`
              : `You owe ₹${Math.abs(myBalance).toFixed(2)}`}
          </div>
        </div>
        <button className="btn secondary" onClick={() => setShowSettle(true)}>Settle Up</button>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'expenses' ? 'active' : ''}`} onClick={() => setTab('expenses')}>Expenses</div>
        <div className={`tab ${tab === 'balances' ? 'active' : ''}`} onClick={() => setTab('balances')}>Balances</div>
        <div className={`tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>Members</div>
        <div className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</div>
      </div>

      {tab === 'expenses' && (
        <div className="card">
          {expenses.length === 0 && <p className="muted">No expenses yet.</p>}
          {expenses.map((exp) => (
            <div className="expense-item" key={exp.id}>
              <div>
                <Link to={`/expenses/${exp.id}`}><strong>{exp.description}</strong></Link>
                <div className="muted" style={{ fontSize: 13 }}>
                  Paid by {exp.paid_by_name} · {exp.expense_date} · {exp.split_type}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <strong>₹{Number(exp.amount).toFixed(2)}</strong>
                <button className="btn secondary" onClick={() => handleDeleteExpense(exp.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'balances' && balances && (
        <div className="card">
          <h4>Who owes whom (pairwise)</h4>
          {balances.pairwise.length === 0 && <p className="muted">Everyone is settled up.</p>}
          {balances.pairwise.map((p, i) => (
            <div className="balance-row" key={i}>
              <span>{p.fromName} owes {p.toName}</span>
              <strong className="negative">₹{p.amount.toFixed(2)}</strong>
            </div>
          ))}

          <h4 style={{ marginTop: 24 }}>Suggested settlements (simplified)</h4>
          {balances.suggestions.length === 0 && <p className="muted">No payments needed.</p>}
          {balances.suggestions.map((s, i) => (
            <div className="balance-row" key={i}>
              <span>{s.fromName} → {s.toName}</span>
              <strong>₹{s.amount.toFixed(2)}</strong>
            </div>
          ))}
        </div>
      )}

      {tab === 'members' && (
        <div className="card">
          {group.members.map((m) => (
            <div className="member-row" key={m.id}>
              <div>
                {m.name} {m.id === user.id && <span className="muted">(you)</span>}
                {m.role === 'admin' && <span className="muted"> · admin</span>}
              </div>
              {group.currentUserRole === 'admin' && m.id !== user.id && m.role !== 'admin' && (
                <button className="btn secondary" onClick={() => handleRemoveMember(m.id)}>Remove</button>
              )}
            </div>
          ))}
          <button className="btn" style={{ marginTop: 12 }} onClick={() => setShowInvite(true)}>+ Invite Member</button>
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          <h4>Settlement History</h4>
          {settlements.length === 0 && <p className="muted">No settlements recorded yet.</p>}
          {settlements.map((s) => (
            <div className="balance-row" key={s.id}>
              <span>{s.paid_by_name} paid {s.paid_to_name}</span>
              <div>
                <strong>₹{Number(s.amount).toFixed(2)}</strong>
                <div className="muted" style={{ fontSize: 12 }}>{new Date(s.settled_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Invite Member</h3>
            <p className="muted">The person must already have a SplitClone account.</p>
            <form onSubmit={handleInvite}>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
              </div>
              {inviteError && <div className="error-text">{inviteError}</div>}
              <div className="flex-between" style={{ gap: 8 }}>
                <button type="button" className="btn secondary" onClick={() => setShowInvite(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn" style={{ flex: 1 }}>Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettle && (
        <SettleUpModal
          groupId={id}
          members={group.members}
          currentUserId={user.id}
          onClose={() => setShowSettle(false)}
          onSettled={() => {
            setShowSettle(false);
            load();
          }}
        />
      )}
    </div>
  );
}
