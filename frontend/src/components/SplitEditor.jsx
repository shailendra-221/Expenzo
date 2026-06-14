import { useEffect } from 'react';

export default function SplitEditor({ splitType, members, splits, onChange }) {
  // splits: [{ user_id, name, value, included }]

  const updateSplit = (userId, field, val) => {
    onChange(splits.map((s) => (s.user_id === userId ? { ...s, [field]: val } : s)));
  };

  const toggleIncluded = (userId) => {
    onChange(splits.map((s) => (s.user_id === userId ? { ...s, included: !s.included } : s)));
  };

  const includedSplits = splits.filter((s) => s.included);

  const renderInputs = () => {
    if (splitType === 'equal') {
      return (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>Select who is included:</p>
          {splits.map((s) => (
            <div key={s.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <input
                type="checkbox"
                id={`inc_${s.user_id}`}
                checked={s.included}
                onChange={() => toggleIncluded(s.user_id)}
                style={{ width: 'auto' }}
              />
              <label htmlFor={`inc_${s.user_id}`} style={{ fontWeight: 'normal', margin: 0 }}>{s.name}</label>
            </div>
          ))}
        </div>
      );
    }

    if (splitType === 'unequal') {
      return (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>Enter exact amount for each person (must sum to total):</p>
          {splits.map((s) => (
            <div className="split-row" key={s.user_id}>
              <label style={{ margin: 0, fontWeight: 'normal' }}>{s.name}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={s.value}
                onChange={(e) => updateSplit(s.user_id, 'value', e.target.value)}
                placeholder="₹0.00"
              />
            </div>
          ))}
        </div>
      );
    }

    if (splitType === 'percentage') {
      const total = splits.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      return (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>
            Enter percentage for each person. Total: <strong className={Math.abs(total - 100) < 0.01 ? 'positive' : 'negative'}>{total.toFixed(1)}%</strong> (must be 100%)
          </p>
          {splits.map((s) => (
            <div className="split-row" key={s.user_id}>
              <label style={{ margin: 0, fontWeight: 'normal' }}>{s.name}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={s.value}
                onChange={(e) => updateSplit(s.user_id, 'value', e.target.value)}
                placeholder="%"
              />
            </div>
          ))}
        </div>
      );
    }

    if (splitType === 'share') {
      const totalShares = splits.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      return (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>
            Enter shares. Total shares: <strong>{totalShares}</strong>
          </p>
          {splits.map((s) => (
            <div className="split-row" key={s.user_id}>
              <label style={{ margin: 0, fontWeight: 'normal' }}>{s.name}</label>
              <input
                type="number"
                step="1"
                min="0"
                value={s.value}
                onChange={(e) => updateSplit(s.user_id, 'value', e.target.value)}
                placeholder="shares"
              />
            </div>
          ))}
        </div>
      );
    }
  };

  return <div>{renderInputs()}</div>;
}
