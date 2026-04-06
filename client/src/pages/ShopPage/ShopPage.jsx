import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import * as userQ from '../../queries/userQueries';
import './ShopPage.css';

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    price: 500,
    color: '#667eea',
    features: ['1,000 messages/month', '200 image analyses', '500 memories', '300 code generations'],
  },
  {
    id: 'ultra',
    name: 'Ultra',
    price: 10000,
    color: '#764ba2',
    features: ['Unlimited messages', 'Unlimited images', 'Unlimited memories', 'Unlimited code', 'Priority support'],
  },
];

export default function ShopPage() {
  const { user, supabase } = useAuth();
  const { coins, plan, refreshUser, loading } = useUser();

  const handleBuy = async (p) => {
    if (plan === p.id) return alert('You already have this plan!');
    if (coins < p.price) return alert('Not enough coins!');
    if (!confirm(`Upgrade to ${p.name} for ${p.price} coins?`)) return;

    try {
      await userQ.updateUserPlan(supabase, user.id, p.id, p.price);
      await refreshUser();
      alert(`Upgraded to ${p.name}!`);
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  if (loading) return <div className="shop-page"><div className="shop-loading">Loading...</div></div>;

  return (
    <div className="shop-page">
      <div className="shop-header">
        <h2>Shop</h2>
        <div className="coin-display">&#x1FA99; {coins} coins</div>
      </div>
      <p className="shop-subtitle">Current plan: <strong>{plan}</strong></p>

      <div className="plans-grid">
        {PLANS.map(p => (
          <div key={p.id} className="plan-card" style={{ '--plan-color': p.color }}>
            <h3>{p.name}</h3>
            <div className="plan-price">{p.price} coins</div>
            <ul className="plan-features">
              {p.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            <button
              className="plan-buy-btn"
              onClick={() => handleBuy(p)}
              disabled={plan === p.id}
            >
              {plan === p.id ? 'Current Plan' : `Upgrade to ${p.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
