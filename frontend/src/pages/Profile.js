import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { User, Mail, Lock, LogOut, Bell, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PageFooter = () => (
  <footer className="bg-[#1C1917] mt-24">
    <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-base font-black tracking-[0.18em] text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          VAKAR GAMES
        </Link>
        <Link to="/games" className="text-xs text-[#78716C] hover:text-white transition-colors">Games</Link>
        <Link to="/blog" className="text-xs text-[#78716C] hover:text-white transition-colors">Blog</Link>
      </div>
      <p className="text-xs text-[#44403C]">&copy; Vakar Games {new Date().getFullYear()}</p>
    </div>
  </footer>
);

const PasswordField = ({ label, value, onChange, autoComplete, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] pointer-events-none" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          className="w-full pl-9 pr-9 py-2.5 bg-[#F9F7F4] border border-[#E8E3DB] text-[#1C1917] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A8A29E]"
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#78716C] transition-colors"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  );
};

const Profile = () => {
  const { user, logout, changePassword, token } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    document.title = 'My Account — Vakar Games';
    if (!user) { navigate('/login'); return; }
    fetchNotifications();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setNotifUnread(data.unread || 0);
      }
    } catch {
      // silent
    } finally {
      setNotifLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
      setNotifUnread(u => Math.max(0, u - 1));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(ns => ns.map(n => ({ ...n, read: true })));
      setNotifUnread(0);
    } catch { /* silent */ }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    setPwLoading(true);
    const result = await changePassword({ currentPassword: currentPw, newPassword: newPw });
    setPwLoading(false);
    if (result.success) {
      setPwSuccess(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } else {
      setPwError(result.error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || user.username?.[0]?.toUpperCase() || '?';

  return (
    <div className="bg-[#F9F7F4] min-h-screen">
      <PublicNav />

      <div className="pt-16">
        {/* Page header */}
        <div className="bg-white border-b border-[#E8E3DB] py-12 px-6">
          <div className="max-w-3xl mx-auto flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-xl font-bold text-[#4ECDC4] shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1C1917]">
                {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
              </h1>
              <p className="text-sm text-[#78716C]">{user.email}</p>
              {user.is_super_admin && (
                <span className="inline-block mt-1 text-xs font-semibold text-[#4ECDC4] bg-[#4ECDC4]/10 px-2 py-0.5 rounded">
                  Super Admin
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#78716C] hover:text-red-600 border border-[#E8E3DB] hover:border-red-200 rounded-lg transition-all"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">

          {/* Account info */}
          <div className="bg-white border border-[#E8E3DB] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[#1C1917] uppercase tracking-wider mb-5 flex items-center gap-2">
              <User size={14} className="text-[#4ECDC4]" />
              Account Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'First Name', value: user.firstName || '—' },
                { label: 'Last Name', value: user.lastName || '—' },
                { label: 'Username', value: '@' + user.username },
                { label: 'Email', value: user.email },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-[#A8A29E] uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm text-[#1C1917]">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white border border-[#E8E3DB] rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-[#1C1917] uppercase tracking-wider flex items-center gap-2">
                <Bell size={14} className="text-[#4ECDC4]" />
                Notifications
                {notifUnread > 0 && (
                  <span className="bg-[#4ECDC4] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {notifUnread}
                  </span>
                )}
              </h2>
              {notifUnread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-[#78716C] hover:text-[#1C1917] transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifLoading ? (
              <div className="py-6 text-center text-sm text-[#A8A29E]">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-[#A8A29E]">No notifications yet.</div>
            ) : (
              <div className="space-y-2">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      n.read
                        ? 'border-[#F0EDE8] bg-[#FAFAF9]'
                        : 'border-[#4ECDC4]/20 bg-[#4ECDC4]/5 hover:bg-[#4ECDC4]/8'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${n.read ? 'text-[#78716C]' : 'text-[#1C1917] font-semibold'}`}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-xs text-[#A8A29E] mt-0.5 leading-relaxed">{n.message}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.read && <div className="w-2 h-2 rounded-full bg-[#4ECDC4]" />}
                        <time className="text-[10px] text-[#A8A29E]">
                          {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </time>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Change password */}
          <div className="bg-white border border-[#E8E3DB] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[#1C1917] uppercase tracking-wider mb-5 flex items-center gap-2">
              <Lock size={14} className="text-[#4ECDC4]" />
              Change Password
            </h2>
            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
              <PasswordField
                label="Current password"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                autoComplete="current-password"
                placeholder="Your current password"
              />
              <PasswordField
                label="New password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                autoComplete="new-password"
                placeholder="Min. 8 characters, 1 letter, 1 number"
              />
              <PasswordField
                label="Confirm new password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                placeholder="Repeat your new password"
              />

              {pwError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                  <AlertTriangle size={14} className="shrink-0" />
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 text-green-600 text-sm rounded-lg">
                  <CheckCircle size={14} className="shrink-0" />
                  Password updated successfully.
                </div>
              )}

              <button
                type="submit"
                disabled={pwLoading}
                className="bg-[#1C1917] hover:bg-[#2D2926] text-white rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {pwLoading ? 'Saving…' : 'Update Password'}
              </button>
            </form>
          </div>

        </div>
      </div>

      <PageFooter />
    </div>
  );
};

export default Profile;
