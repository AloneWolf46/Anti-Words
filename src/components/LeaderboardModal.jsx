import React, { useState, useEffect } from 'react';
import { getLeaderboard } from '../services/leaderboardService';

export default function LeaderboardModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('score'); // 'score' | 'wpm'
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoading(true);

    getLeaderboard(30).then((res) => {
      if (mounted) {
        setLeaderboardData(res.data || []);
        setIsOnline(res.isOnline);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sortedData = [...leaderboardData].sort((a, b) => {
    if (activeTab === 'wpm') {
      return (b.wpm || 0) - (a.wpm || 0);
    }
    return (b.score || 0) - (a.score || 0);
  });

  return (
    <div className="modern-modal-backdrop" onClick={onClose}>
      <div className="modern-leaderboard-modal" onClick={(e) => e.stopPropagation()}>
        {/* Üst Başlık & Kapatma */}
        <div className="modern-lb-header">
          <div className="modern-lb-title-cluster">
            <div className="modern-lb-icon-box">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fbbf24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4M5 4h14v4a7 7 0 01-7 7 7 7 0 01-7-7V4zM5 6H3a2 2 0 00-2 2v1a4 4 0 004 4h0M19 6h2a2 2 0 012 2v1a4 4 0 01-4 4h0" />
              </svg>
            </div>
            <div>
              <h2 className="modern-lb-title">LİDERLİK TABLOSU</h2>
              <p className="modern-lb-subtitle">En iyiler burada! Zirveye adını yazdır.</p>
            </div>
          </div>

          <button type="button" className="modern-modal-close-btn" onClick={onClose} title="Kapat">
            ✕
          </button>
        </div>

        {/* Canlı Bağlantı ve Sıralama Tabları */}
        <div className="modern-lb-toolbar">
          <div className="modern-lb-tabs-pill">
            <button
              type="button"
              className={`lb-pill-tab ${activeTab === 'score' ? 'active' : ''}`}
              onClick={() => setActiveTab('score')}
            >
              🏆 PUAN SIRALAMASI
            </button>
            <button
              type="button"
              className={`lb-pill-tab ${activeTab === 'wpm' ? 'active' : ''}`}
              onClick={() => setActiveTab('wpm')}
            >
              ⚡ HIZ (WPM)
            </button>
          </div>

          <div className="modern-lb-status">
            <span className="live-pulsing-dot small" />
            <span className="status-text">{isOnline ? 'Canlı Bulut Veritabanı' : 'Yerel Liste'}</span>
          </div>
        </div>

        {/* Tablo İçeriği */}
        <div className="modern-lb-table-container">
          {isLoading ? (
            <div className="modern-lb-loading">
              <span className="loading-spinner" />
              <span>Sıralama yükleniyor...</span>
            </div>
          ) : sortedData.length === 0 ? (
            <div className="modern-lb-empty">
              <span>🏆 Henüz kaydedilmiş bir skor yok. İlk şampiyon sen ol!</span>
            </div>
          ) : (
            <table className="modern-lb-table">
              <thead>
                <tr>
                  <th style={{ width: '44px' }}>SIRA</th>
                  <th>OYUNCU</th>
                  <th>PUAN</th>
                  <th>HIZ</th>
                  <th className="hide-on-mobile">DOĞRULUK</th>
                  <th className="hide-on-mobile">MOD</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((item, index) => {
                  const rank = index + 1;
                  const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
                  const isPodium = rank <= 3;

                  return (
                    <tr key={item.id || index} className={`lb-row ${isPodium ? `podium-${rank}` : ''}`}>
                      <td className="lb-rank-col">
                        <span className={`rank-tag ${isPodium ? 'podium-tag' : ''}`}>{rankBadge}</span>
                      </td>
                      <td className="lb-user-col">
                        <span className="lb-user-name">{item.username || 'Anonim'}</span>
                      </td>
                      <td className="lb-score-col">
                        <span className="lb-score-num">{(item.score || 0).toLocaleString('tr-TR')}</span>
                      </td>
                      <td className="lb-wpm-col">
                        <span className="lb-wpm-num">{item.wpm || 0} WPM</span>
                      </td>
                      <td className="lb-acc-col hide-on-mobile">%{item.accuracy || 100}</td>
                      <td className="lb-mode-col hide-on-mobile">
                        <span className={`mode-badge-pill ${item.mode === '1v1' ? 'duel' : 'classic'}`}>
                          {item.mode === '1v1' ? '1v1' : 'Klasik'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
