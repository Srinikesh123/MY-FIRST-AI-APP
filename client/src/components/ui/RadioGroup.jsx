import './RadioGroup.css';

export default function RadioGroup({ label, name, options, value, onChange, description }) {
  return (
    <div className="radio-group-container">
      <label className="radio-group-label">{label}</label>
      <div className="radio-options">
        {options.map((opt) => (
          <label key={opt.value} className={`radio-option ${value === opt.value ? 'selected' : ''}`}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {description && <small className="radio-desc">{description}</small>}
    </div>
  );
}
