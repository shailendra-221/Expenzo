import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="navbar">
      <Link to="/" className="brand">SplitClone</Link>
      <div className="nav-links">
        <span className="muted">Hi, {user.name}</span>
        <button className="btn secondary" onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}
