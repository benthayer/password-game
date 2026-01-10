/**
 * Salt configuration section.
 * Toggle + salt value input.
 */

interface SaltSectionProps {
  includeSalt: boolean;
  onIncludeSaltChange: (include: boolean) => void;
  salt: string;
  onSaltChange: (salt: string) => void;
}

export default function SaltSection({
  includeSalt,
  onIncludeSaltChange,
  salt,
  onSaltChange,
}: SaltSectionProps) {
  return (
    <div className="config-section">
      <h3>Salt</h3>
      
      <SaltToggle 
        checked={includeSalt} 
        onChange={onIncludeSaltChange} 
      />
      
      {includeSalt && (
        <SaltInput value={salt} onChange={onSaltChange} />
      )}
    </div>
  );
}

function SaltToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="config-field checkbox-field">
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        Include salt
      </label>
      <div className="field-hint">
        Salt prevents multi-target attacks. Required if you expect multiple users.
      </div>
    </div>
  );
}

function SaltInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="config-field">
      <label>Salt value</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter a unique salt"
      />
    </div>
  );
}

