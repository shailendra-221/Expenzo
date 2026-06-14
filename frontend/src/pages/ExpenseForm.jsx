import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import SplitEditor from '../components/SplitEditor';

function initSplits(members) {
  return members.map((m) => ({
    user_id: m.id,
    name: m.name,
    value: '0',
    included: true,
  }));
}

export default function ExpenseForm({ mode }) {
  // mode: 'create' | 'edit'
  const { groupId, expenseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [members, setMembers] = useState([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [splitType, setSplitType] = useState('equal');
  const [splits, setSplits] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resolvedGroupId, setResolvedGroupId] = useState(groupId);

  useEffect(() => {
    const loadGroup = async (gid) => {
      const res = await api.get(`/groups/${gid}`);
      setMembers(res.data.members);
      if (mode === 'create') {
        setPaidBy(user.id);
        setSplits(initSplits(res.data.members));
      }
    };

    if (mode === 'create') {
      loadGroup(groupId);
    } else {
      // edit: load expense first to get groupId
      api.get(`/expenses/${expenseId}`).then((res) => {
        const exp = res.data;
        setResolvedGroupId(exp.group_id);
        setDescription(exp.description);
        setAmount(String(exp.amount));
        setPaidBy(exp.paid_by);
        setExpenseDate(exp.expense_date.slice(0, 10));
        setSplitType(exp.split_type);

        api.get(`/groups/${exp.group_id}`).then((gRes) => {
          const grpMembers = gRes.data.members;
          setMembers(grpMembers);

          const existingSplits = exp.splits;
          setSplits(
            grpMembers.map((m) => {
              const existing = existingSplits.find((s) => s.user_id === m.id);
              return {
                user_id: m.id,
                name: m.name,
                included: !!existing,
                value:
                  exp.split_type === 'percentage'
                    ? String(existing?.percentage || 0)
                    : exp.split_type === 'share'
                    ? String(existing?.shares || 0)
                    : String(existing?.amount || 0),
              };
            })
          );
        });
      });
    }
  }, []);

  const buildPayload = () => {
    const totalAmount = Number(amount);
    if (!totalAmount || totalAmount <= 0) throw new Error('Enter a valid amount');
    if (!description.trim()) throw new Error('Description is required');
    if (!paidBy) throw new Error('Select who paid');

    let participants;
    if (splitType === 'equal') {
      participants = splits
        .filter((s) => s.included)
        .map((s) => ({ user_id: s.user_id, value: 0 }));
      if (participants.length === 0) throw new Error('Select at least one participant');
    } else {
      participants = splits
        .filter((s) => Number(s.value) > 0)
        .map((s) => ({ user_id: s.user_id, value: s.value }));
      if (participants.length === 0) throw new Error('At least one participant must have a value > 0');
    }

    return {
      description: description.trim(),
      amount: totalAmount,
      paid_by: Number(paidBy),
      expense_date: expenseDate,
      split_type: splitType,
      splits: participants,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    let payload;
    try {
      payload = buildPayload();
    } catch (err) {
      setError(err.message);
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await api.post(`/groups/${resolvedGroupId}/expenses`, payload);
        navigate(`/groups/${resolvedGroupId}`);
      } else {
        await api.put(`/expenses/${expenseId}`, payload);
        navigate(`/expenses/${expenseId}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelTo = mode === 'create'
    ? `/groups/${resolvedGroupId}`
    : `/expenses/${expenseId}`;

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <h2>{mode === 'create' ? 'Add Expense' : 'Edit Expense'}</h2>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner at Olive"
              required
            />
          </div>

          <div className="form-group">
            <label>Total Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Paid by</label>
            <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.id === user.id ? '(you)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Split type</label>
            <select
              value={splitType}
              onChange={(e) => {
                setSplitType(e.target.value);
                setSplits(initSplits(members));
              }}
            >
              <option value="equal">Equal</option>
              <option value="unequal">Unequal (exact amounts)</option>
              <option value="percentage">By percentage</option>
              <option value="share">By shares</option>
            </select>
          </div>

          {splits.length > 0 && (
            <div className="form-group">
              <label>Split details</label>
              <SplitEditor
                splitType={splitType}
                members={members}
                splits={splits}
                onChange={setSplits}
              />
            </div>
          )}

          {error && <div className="error-text">{error}</div>}

          <div className="flex-between" style={{ gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => navigate(cancelTo)}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button type="submit" className="btn" disabled={submitting} style={{ flex: 1 }}>
              {submitting ? 'Saving...' : mode === 'create' ? 'Add Expense' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
