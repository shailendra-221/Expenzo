import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import ExpenseForm from './pages/ExpenseForm';
import ExpenseDetail from './pages/ExpenseDetail';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/groups/:id" element={<Protected><GroupDetail /></Protected>} />
        <Route
          path="/groups/:groupId/expenses/new"
          element={<Protected><ExpenseForm mode="create" /></Protected>}
        />
        <Route path="/expenses/:id" element={<Protected><ExpenseDetail /></Protected>} />
        <Route
          path="/expenses/:expenseId/edit"
          element={<Protected><ExpenseForm mode="edit" /></Protected>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
