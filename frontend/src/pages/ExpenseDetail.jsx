import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import ChatBox from '../components/ChatBox';

export default function ExpenseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);

  useEffect(() => {
    api.get(`/expenses/${id}`).then((res) => setExpense(res.data));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    navigate(`/groups/${expense.group_id}`);
  };

  if (!expense) return <div className="container">Loading...</div>;

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <Link to={`/groups/${expense.group_id}`} className="muted" style={{ fontSize: 13 }}>
            ← Back to group
          </Link>
          <h2 style={{ margin: '4px 0' }}>{expense.description}</h2>
          <div className="muted">
            Paid by <strong>{expense.paid_by_name}</strong> · {expense.expense_date?.slice(0, 10)} · {expense.split_type} split
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/expenses/${id}/edit`} className="btn secondary">Edit</Link>
          <button className="btn danger" onClick={handleDelete}>Delete</button>
        </div>
      </div>

      <div className="card">
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Total</h3>
          <span style={{ fontSize: 22, fontWeight: 700 }}>₹{Number(expense.amount).toFixed(2)}</span>
        </div>

        <h4>Split breakdown</h4>
        {expense.splits.map((s) => (
          <div className="balance-row" key={s.user_id}>
            <div>
              <strong>{s.name}</strong>
              {expense.split_type === 'percentage' && s.percentage != null && (
                <span className="muted"> ({s.percentage}%)</span>
              )}
              {expense.split_type === 'share' && s.shares != null && (
                <span className="muted"> ({s.shares} share{s.shares !== 1 ? 's' : ''})</span>
              )}
            </div>
            <span>₹{Number(s.amount).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Comments</h4>
        <ChatBox expenseId={id} />
      </div>
    </div>
  );
}
