import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import './BookPage.css';

export default function BookPage() {
  const { user } = useAuth();
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get(`/book?userId=${user.id}`)
      .then(data => setPages(data.pages || data || []))
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, [user]);

  const goNext = () => {
    if (currentPage < pages.length - 1) setCurrentPage(p => p + 1);
  };

  const goPrev = () => {
    if (currentPage > 0) setCurrentPage(p => p - 1);
  };

  if (loading) {
    return (
      <div className="book-page">
        <div className="book-loading">Loading your book...</div>
      </div>
    );
  }

  return (
    <div className="book-page">
      <div className="book-header">
        <h2>My Book</h2>
        <p>Your saved pages and memories</p>
      </div>

      {pages.length === 0 ? (
        <div className="book-empty">
          <span className="book-empty-icon">📖</span>
          <p>Your book is empty. Pages will appear here as you save them.</p>
        </div>
      ) : (
        <div className="book-viewer">
          <div className="book-display">
            {pages[currentPage]?.image_url && (
              <img src={pages[currentPage].image_url} alt="Page" className="book-img" />
            )}
            {pages[currentPage]?.caption && (
              <p className="book-caption">{pages[currentPage].caption}</p>
            )}
          </div>
          <div className="book-controls">
            <button onClick={goPrev} disabled={currentPage === 0} className="book-nav-btn">Previous</button>
            <span className="book-page-num">{currentPage + 1} / {pages.length}</span>
            <button onClick={goNext} disabled={currentPage === pages.length - 1} className="book-nav-btn">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
