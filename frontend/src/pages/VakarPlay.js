import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Gamepad2, Clock, ChevronRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MINT = '#7C3AED';
const MINT_DARK = '#5B21B6';
const MINT_BG = '#F5F3FF';
const MINT_LIGHT = '#EDE9FE';
const MINT_MID = '#A78BFA';

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function GameCard({ game }) {
  const [imgError, setImgError] = useState(false);
  const coverUrl = game.cover_image
    ? (game.cover_image.startsWith('/') ? `${API_URL}${game.cover_image}` : game.cover_image)
    : null;

  return (
    <div className="rounded-xl bg-white border border-[#EDE4FD] hover:border-[#C4B5FD] transition-colors overflow-hidden">
      {/* Game logo / cover */}
      <div className="relative w-full bg-[#F5F3FF]" style={{ height: 160 }}>
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
      </div>

      {/* Name + last session */}
      <div className="p-4">
        <h3 className="font-bold text-[#1D1D1F] text-sm mb-1.5 truncate">{game.name}</h3>
        <div className="flex items-center gap-1.5">
          <Clock size={11} style={{ color: MINT }} />
          <span className="text-xs text-[#6B7280]">Last session: {timeAgo(game.last_updated)}</span>
        </div>
      </div>
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: MINT_BG }}>
      <PublicNav />

      <div className="pt-[52px] flex-1">

        {/* Hero */}
        <section className="bg-white border-b border-[#EDE4FD] px-6 md:px-10 lg:px-16 pt-14 pb-10">
          <div className="max-w-screen-xl mx-auto">
            <p className="text-xs font-semibold mb-3" style={{ color: MINT }}>
              Vakar Play
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em] text-[#1D1D1F]">
              My games
            </h1>
            <p className="text-[#6B7280] text-sm mt-2">
              Welcome back, <strong className="text-[#1D1D1F]">{firstName}</strong>.
              {games.length > 0
                ? ` ${games.length} game${games.length > 1 ? 's' : ''} in your library.`
                : ' Start playing to build your library.'}
            </p>
          </div>
        </section>

        <div className="max-w-screen-xl mx-auto px-6 md:px-10 lg:px-16 py-10">

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map(i => <div key={i} className="rounded-xl h-56 bg-[#EDE9FE] animate-pulse" />)}
            </div>
          ) : error ? (
            <div className="text-center py-24">
              <p className="text-[#9CA3AF] text-sm">Could not load your library. Please try again later.</p>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-24">
              <div
                className="rounded-xl w-16 h-16 flex items-center justify-center mx-auto mb-5"
                style={{ background: MINT_LIGHT }}
              >
                <Gamepad2 size={28} style={{ color: MINT_DARK }} />
              </div>
              <h2 className="text-xl font-bold text-[#1D1D1F] mb-3">
                No games yet
              </h2>
              <p className="text-[#6B7280] text-sm mb-6 max-w-sm mx-auto">
                Your games will appear here once you start playing Vakar Games titles.
              </p>
              <Link
                to="/games"
                className="rounded-full inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 transition-colors"
                style={{ background: MINT_DARK }}
              >
                Discover our games <ChevronRight size={14} />
              </Link>
            </div>
          ) : (
            <>
              <p
                className="text-xs font-semibold mb-6"
                style={{ color: MINT_DARK }}
              >
                Your library
              </p>
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
