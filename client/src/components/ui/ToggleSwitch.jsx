import './ToggleSwitch.css';

export default function ToggleSwitch({ label, description, checked, onChange }) {
  return (
    <div className="toggle-item">
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-slider" />
        <span className="toggle-label">{label}</span>
      </label>
      {description && <small className="toggle-desc">{description}</small>}
    </div>
  );
}
