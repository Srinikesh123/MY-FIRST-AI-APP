import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import * as gameQ from '../../queries/gameQueries';
import PageHeader from '../../components/ui/PageHeader';
import './GamesPage.css';

export default function GamesPage() {
  const { supabase } = useAuth();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gameQ.loadGames(supabase)
      .then(setGames)
      .catch(err => console.error('Failed to load games:', err))
      .finally(() => setLoading(false));
  }, [supabase]);

  if (loading) {
    return (
      <div className="games-page">
        <PageHeader title="Games" subtitle="Play games to earn coins!" />
        <div className="games-loading">Loading games...</div>
      </div>
    );
  }

  return (
    <div className="games-page">
      <PageHeader title="Games" subtitle="Play games to earn coins!" />
      <div className="games-grid">
        {games.length === 0 ? (
          <div className="empty-state">No games available yet.</div>
        ) : (
          games.map(game => (
            <div key={game.id} className="game-card">
              <span className="game-icon">{game.icon || '🎮'}</span>
              <span className="game-name">{game.name}</span>
              <span className="game-reward">+{game.reward || 1} coins</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
