import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import {
  Gamepad2, Clock, Database, LogIn, ExternalLink, BarChart2,
  Calendar, Activity, ChevronRight,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MINT = '#10B981';
const MINT_DARK = '#059669';
const MINT_BG = '#F0FDF4';
const MINT_LIGHT = '#D1FAE5';
const MINT_MID = '#6EE7B7';

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CATEGORY_LABELS = {
  progress: 'Progress',
  settings: 'Settings',
  inventory: 'Inventory',
  achievements: 'Achievements',
  stats: 'Stats',
};

function GameCard({ game }) {
  const [imgError, setImgError] = useState(false);
  const coverUrl = game.cover_image
    ? (game.cover_image.startsWith('/') ? `${API_URL}${game.cover_image}` : game.cover_image)
    : null;

  return (
    <div className="bg-white border border-[#E2F5EC] hover:border-[#A7F3D0] transition-all group overflow-hidden">
      {/* Cover */}
      <div className="relative w-full bg-[#F0FDF4]" style={{ height: 160 }}>
        {coverUrl && !imgError ? (
          <img
            src={coverUrl}
            alt={game.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 size={32} style={{ color: MINT_MID }} />
          </div>
        )}
        {/* Last active chip */}
        <div
          className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 text-[10px] font-semibold"
          style={{ background: 'rgba(16,185,129,0.9)', color: 'white' }}
        >
          <Activity size={8} />
          {timeAgo(game.last_updated)}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-[#1C1917] text-sm mb-2 truncate group-hover:text-[#059669] transition-colors">
          {game.name}
        </h3>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <Database size={11} style={{ color: MINT }} />
            <span className="text-xs text-[#6B7280]">
              {game.saves_count} {game.saves_count === 1 ? 'save' : 'saves'}
            </span>
          </div>
          {game.categories?.length > 0 && (
            <div className="flex items-center gap-1.5">
              <BarChart2 size={11} style={{ color: MINT }} />
              <span className="text-xs text-[#6B7280]">{game.categories.length} categories</span>
            </div>
          )}
        </div>

        {/* Category tags */}
        {game.categories?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {game.categories.slice(0, 3).map(cat => (
              <span
                key={cat}
                className="text-[9px] font-semibold px-1.5 py-0.5 uppercase tracking-wide"
                style={{ background: MINT_LIGHT, color: MINT_DARK }}
              >
                {CATEGORY_LABELS[cat] || cat}
              </span>
            ))}
            {game.categories.length > 3 && (
              <span className="text-[9px] text-[#9CA3AF] px-1 py-0.5">+{game.categories.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({ value, label, icon: Icon }) {
  return (
    <div className="bg-white border border-[#E2F5EC] p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-8 h-8 flex items-center justify-center"
          style={{ background: MINT_LIGHT }}
        >
          <Icon size={15} style={{ color: MINT_DARK }} />
        </div>
      </div>
      <p className="text-3xl font-black text-[#1C1917] mb-0.5 tabular-nums" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>
        {value}
      </p>
      <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">{label}</p>
    </div>
  );
}

export default function VakarPlay() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = 'Vakar Play — My Games';
    if (!user) { navigate('/login'); return; }
    if (!token) return;
    setLoading(true);
    axios
      .get(`${API_URL}/api/user/play-stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setGames(r.data.games || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user, token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const firstName = user.firstName || user.username;
  const lastGame = games[0];
  const totalSaves = games.reduce((s, g) => s + g.saves_count, 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: MINT_BG }}>
      <PublicNav />

      <div className="pt-16 flex-1">

        {/* Hero */}
        <section className="bg-white border-b border-[#E2F5EC] px-6 md:px-10 lg:px-16 pt-14 pb-10">
          <div className="max-w-screen-xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] uppercase mb-3" style={{ color: MINT }}>
                  Vakar Play
                </p>
                <h1
                  className="text-5xl sm:text-6xl font-black text-[#1C1917] leading-tight"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  MY GAMES
                </h1>
                <p className="text-[#6B7280] text-sm mt-2">
                  Welcome back, <strong className="text-[#1C1917]">{firstName}</strong>.
                  {games.length > 0
                    ? ` You've played ${games.length} game${games.length > 1 ? 's' : ''}.`
                    : ' Start playing to see your stats here.'}
                </p>
              </div>
              {lastGame && (
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                  <Clock size={11} style={{ color: MINT }} />
                  Last active: {timeAgo(lastGame.last_updated)} on <strong className="text-[#1C1917] ml-1">{lastGame.name}</strong>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="max-w-screen-xl mx-auto px-6 md:px-10 lg:px-16 py-10">

          {loading ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#D1FAE5] animate-pulse" />)}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-[#D1FAE5] animate-pulse" />)}
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-24">
              <p className="text-[#9CA3AF] text-sm">Could not load your stats. Please try again later.</p>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-24">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: MINT_LIGHT }}
              >
                <Gamepad2 size={28} style={{ color: MINT_DARK }} />
              </div>
              <h2
                className="text-3xl font-black text-[#1C1917] mb-3"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}
              >
                NO GAMES YET
              </h2>
              <p className="text-[#6B7280] text-sm mb-6 max-w-sm mx-auto">
                Your game saves and stats will appear here once you start playing Vakar Games titles.
              </p>
              <Link
                to="/games"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 transition-colors"
                style={{ background: MINT_DARK }}
              >
                Discover our games <ChevronRight size={14} />
              </Link>
            </div>
          ) : (
            <>
              {/* Stats overview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
                <StatBlock value={games.length} label="Games played" icon={Gamepad2} />
                <StatBlock value={totalSaves} label="Total saves" icon={Database} />
                <StatBlock
                  value={lastGame ? timeAgo(lastGame.last_updated) : '—'}
                  label="Last session"
                  icon={Calendar}
                />
              </div>

              {/* Section label */}
              <div className="flex items-center justify-between mb-6">
                <p
                  className="text-xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: MINT_DARK }}
                >
                  Your library · {games.length} game{games.length > 1 ? 's' : ''}
                </p>
              </div>

              {/* Game grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {games.map(g => <GameCard key={g.slug} game={g} />)}
              </div>
            </>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
