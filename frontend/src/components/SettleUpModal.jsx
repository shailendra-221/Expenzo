import { useState } from 'react';
import api from '../api/client';

export default function SettleUpModal({ groupId, members, currentUserId, onClose, onSettled }) {
  const otherMembers = members.filter((m) => m.id !== currentUserId);
  const [direction, setDirection] = useState('i_paid'); // 'i_paid' or 'they_paid'
  const [otherUserId, setOtherUserId] = useState(otherMembers[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!otherUserId || !amount || Number(amount) <= 0) {
      setError('Please select a person and enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      const paid_by = direction === 'i_paid' ? currentUserId : Number(otherUserId);
      const paid_to = direction === 'i_paid' ? Number(otherUserId) : currentUserId;
      await api.post(`/groups/${groupId}/settlements`, { paid_by, paid_to, amount: Number(amount) });
      onSettled();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record settlement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Settle Up</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Direction</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="i_paid">I paid them</option>
              <option value="they_paid">They paid me</option>
            </select>
          </div>
          <div className="form-group">
            <label>Person</label>
            <select value={otherUserId} onChange={(e) => setOtherUserId(e.target.value)}>
              {otherMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Amount (₹)</label>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="flex-between" style={{ gap: 8 }}>
            <button type="button" className="btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn" disabled={submitting} style={{ flex: 1 }}>
              {submitting ? 'Saving...' : 'Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
