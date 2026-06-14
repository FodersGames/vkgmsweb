import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLATFORM_ICONS = {
  steam: { label: 'Steam', svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012zm8.397-8.308a3.02 3.02 0 00-3.015-3.015 3.02 3.02 0 00-3.015 3.015 3.02 3.02 0 003.015 3.015 3.02 3.02 0 003.015-3.015zm-5.273-.008a2.262 2.262 0 012.256-2.256 2.262 2.262 0 012.256 2.256 2.262 2.262 0 01-2.256 2.256 2.262 2.262 0 01-2.256-2.256z"/></svg> },
  google_play: { label: 'Google Play', svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 1.332L16.698 12l3.302-2.493zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg> },
  apple: { label: 'App Store', svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg> },
  pc: { label: 'PC', svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg> },
  web: { label: 'Web', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  android: { label: 'Android', svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.523 15.341c-.583 0-1.055.473-1.055 1.056s.473 1.055 1.055 1.055c.583 0 1.056-.473 1.056-1.055s-.474-1.056-1.056-1.056zm-11.046 0c-.583 0-1.055.473-1.055 1.056s.473 1.055 1.055 1.055c.583 0 1.056-.473 1.056-1.055s-.473-1.056-1.056-1.056zm11.405-6.02l1.945-3.368c.108-.188.044-.429-.144-.537-.188-.108-.429-.044-.537.144l-1.97 3.41c-1.479-.672-3.14-1.047-4.89-1.047s-3.411.375-4.89 1.047l-1.97-3.41c-.108-.188-.349-.252-.537-.144-.188.108-.252.349-.144.537l1.945 3.368C3.013 11.18.612 14.04.612 17.353h22.776c0-3.313-2.401-6.173-5.506-8.032zM6.477 15.341c-.583 0-1.055.473-1.055 1.056s.473 1.055 1.055 1.055c.583 0 1.056-.473 1.056-1.055s-.473-1.056-1.056-1.056z"/></svg> },
};

const GamesPage = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    document.title = 'Games — Vakar Games';
    axios.get(`${API_URL}/api/website/games/public`).then(r => { setGames(r.data.games); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="bg-[#0a0a0f] text-white min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-black tracking-[0.2em] text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR GAMES</Link>
            <div className="hidden md:flex items-center gap-6">
              <Link to="/games" className="text-xs font-bold tracking-[0.15em] text-white uppercase">Games</Link>
              <Link to="/blog" className="text-xs font-bold tracking-[0.15em] text-[#8A8A9A] hover:text-white transition-colors uppercase">Blog</Link>
            </div>
          </div>
          <button className="md:hidden p-2 text-white" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X size={22}/> : <Menu size={22}/>}</button>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-[#111118] border-t border-white/5 px-6 py-4 space-y-3">
            <Link to="/" className="block text-sm text-[#8A8A9A] hover:text-white py-2" onClick={() => setMobileMenu(false)}>Home</Link>
            <Link to="/games" className="block text-sm text-white py-2" onClick={() => setMobileMenu(false)}>Games</Link>
            <Link to="/blog" className="block text-sm text-[#8A8A9A] hover:text-white py-2" onClick={() => setMobileMenu(false)}>Blog</Link>
          </div>
        )}
      </nav>

      <div className="pt-16">
        <div className="py-16 sm:py-24 px-4 sm:px-6 text-center vakar-soft-grid" style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #0a0a0f 100%)' }}>
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight mb-4 vakar-gradient-title" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>OUR GAMES</h1>
          <p className="text-base sm:text-lg text-white/50 max-w-xl mx-auto">Discover the worlds we've built.</p>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          {loading ? <div className="text-center py-20 text-white/30">Loading...</div> : games.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-2xl font-bold text-white/20 mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>COMING SOON</p>
              <p className="text-white/40">New games are in development.</p>
            </div>
          ) : (
            <div className="space-y-12 sm:space-y-20">
              {games.map((game, idx) => (
                <div key={game.slug} className={`vakar-glass rounded-[2rem] p-5 sm:p-8 lg:p-10 flex flex-col ${idx % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-8 lg:gap-10 items-center vakar-card-hover transition-all duration-300`} data-testid={`game-card-${game.slug}`}>
                  <div className="lg:w-1/2">
                    {game.logo_url ? <img src={game.logo_url.startsWith('/') ? `${API_URL}${game.logo_url}` : game.logo_url} alt={game.name} className="w-full max-w-md mx-auto rounded-2xl shadow-2xl shadow-black/50 object-cover" /> :
                     game.screenshots?.length > 0 ? <img src={game.screenshots[0].startsWith('/') ? `${API_URL}${game.screenshots[0]}` : game.screenshots[0]} alt={game.name} className="w-full rounded-2xl shadow-2xl shadow-black/50 object-cover" /> :
                     <div className="w-full aspect-video bg-white/5 rounded-2xl flex items-center justify-center"><span className="text-white/20 text-2xl font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{game.name}</span></div>}
                  </div>
                  <div className="lg:w-1/2 space-y-6">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{game.name}</h2>
                    <p className="text-white/60 leading-relaxed text-base sm:text-lg">{game.description}</p>
                    {game.screenshots?.length > 1 && (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {game.screenshots.slice(1, 4).map((s, i) => <img key={i} src={s.startsWith('/') ? `${API_URL}${s}` : s} alt="" className="h-20 sm:h-24 rounded-lg object-cover flex-shrink-0 border border-white/10" />)}
                      </div>
                    )}
                    {game.platforms?.length > 0 && (
                      <div className="flex gap-3 flex-wrap">
                        {game.platforms.map((p, i) => {
                          const pl = PLATFORM_ICONS[p.name];
                          return pl ? (
                            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-[#4ECDC4]/30 transition-all group" data-testid={`platform-${p.name}`}>
                              <span className="text-white/60 group-hover:text-[#4ECDC4] transition-colors">{pl.svg}</span>
                              <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">{pl.label}</span>
                            </a>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-white/10 bg-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-lg font-black tracking-[0.2em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR GAMES</Link>
            <Link to="/games" className="text-xs tracking-[0.1em] text-[#8A8A9A] hover:text-white transition-colors uppercase">Games</Link>
            <Link to="/blog" className="text-xs tracking-[0.1em] text-[#8A8A9A] hover:text-white transition-colors uppercase">Blog</Link>
          </div>
          <p className="text-xs text-[#8A8A9A]">&copy; VAKAR GAMES {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
};

export default GamesPage;
