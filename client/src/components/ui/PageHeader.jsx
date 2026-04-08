import { useNavigate } from 'react-router-dom';
import './PageHeader.css';

export default function PageHeader({ title, subtitle, backTo = '/more' }) {
  const navigate = useNavigate();

  return (
    <div className="page-header">
      <button className="page-back-btn" onClick={() => navigate(backTo)} title="Back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div className="page-header-text">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}
