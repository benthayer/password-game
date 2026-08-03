/**
 * Up-front privacy notice.
 *
 * The point of this banner is that the encryption claims and the privacy claims
 * are verifiable to very different degrees. A visitor can read the client and
 * check the crypto themselves; they cannot check anything about what my server
 * or my hosting providers record. So the banner says so plainly and points at
 * the fix that doesn't require trusting me (a VPN) rather than reassuring them.
 *
 * Collapsed by default but always present — this is not dismissible-and-forgotten,
 * because someone arriving from a link should see it on the page they land on.
 */

import { useState } from 'react';
import './PrivacyNotice.css';

const README_PRIVACY_URL =
  'https://github.com/benthayer/password-game#privacy-what-actually-leaks';

export default function PrivacyNotice() {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className="privacy-notice" aria-label="Privacy notice">
      <div className="privacy-notice-summary">
        <span className="privacy-notice-text">
          <strong>Your file is encrypted and I can't read it — but I can't prove anything about
          your IP or your timing metadata.</strong>{' '}
          Those claims are unverifiable from the outside, so don't take them on trust.
          Use a VPN or Tor and the question stops mattering.
        </span>
        <button
          type="button"
          className="privacy-notice-toggle"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide details' : 'What leaks?'}
        </button>
      </div>

      {expanded && (
        <ul className="privacy-notice-details">
          <li>
            <strong>IPs:</strong> logging is switched off for this app's web server and the app
            never reads your IP — but my VPS provider sees all traffic regardless, and you have
            no way to check either statement.
          </li>
          <li>
            <strong>DNS &amp; TLS:</strong> your resolver and ISP can still see that you visited
            this site, and when. That's the leak a VPN actually fixes.
          </li>
          <li>
            <strong>Payments:</strong> Stripe and Coinbase see your IP directly, and a crypto
            payment records the sending wallet next to your account. A coupon code avoids this.
          </li>
          <li>
            <strong>Timestamps:</strong> upload and last-download times are stored per address
            hash, and credit deductions reveal roughly how often a file has been fetched. A VPN
            does not help with this.
          </li>
          <li>
            <strong>Delete isn't erase:</strong> the storage provider keeps prior versions behind
            delete markers, and the object key is your address hash.
          </li>
          <li>
            <a href={README_PRIVACY_URL} target="_blank" rel="noopener noreferrer">
              Full write-up, including what I verified and how →
            </a>
          </li>
        </ul>
      )}
    </aside>
  );
}
