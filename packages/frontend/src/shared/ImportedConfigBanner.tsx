/**
 * Banner shown when the config form is bound to an uploaded JSON file.
 * Fields are locked while bound; "Edit manually" unbinds.
 */

import './ImportedConfigBanner.css';

export default function ImportedConfigBanner({
  onEditManually,
}: {
  onEditManually: () => void;
}) {
  return (
    <div className="imported-config-banner">
      <span className="imported-config-icon">🔒</span>
      <span className="imported-config-text">
        Using uploaded JSON configuration — fields are locked
      </span>
      <button className="imported-config-unlock" onClick={onEditManually}>
        Edit manually
      </button>
    </div>
  );
}
