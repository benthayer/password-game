import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { getCouponGates, mintCouponToken } from './coupon-api';
import './CouponPage.css';

/**
 * Public coupon page: exchange a coupon code for a redeem token.
 *
 * The token is shown exactly once — the server stores only its hash and cannot
 * reproduce it — so the UI has to make copying it feel deliberate.
 */
export default function CouponPage() {
  const [code, setCode] = useState('');
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mintOpen, setMintOpen] = useState<boolean | null>(null);

  useEffect(() => {
    getCouponGates()
      .then(gates => setMintOpen(gates.mintOpen))
      .catch(() => setMintOpen(null));
  }, []);

  useEffect(() => {
    if (!token) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(token, { width: 320, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [token]);

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || minting) return;

    setMinting(true);
    setError(null);
    try {
      const minted = await mintCouponToken(code.trim());
      setToken(minted.token);
      setCredits(minted.credits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mint a token');
    } finally {
      setMinting(false);
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the token and copy it manually');
    }
  };

  const handleAnother = () => {
    setToken(null);
    setCredits(0);
    setCode('');
    setError(null);
  };

  if (token) {
    return (
      <div className="coupon-page">
        <div className="coupon-card">
          <h1>Your token</h1>
          <p className="coupon-subtitle">
            Worth {credits} credit{credits === 1 ? '' : 's'}
          </p>

          {qrDataUrl && <img className="coupon-qr" src={qrDataUrl} alt="Token QR code" />}

          <div className="coupon-token">{token}</div>

          <button className="coupon-copy" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy token'}
          </button>

          <p className="coupon-warning">
            Save this now. It is shown only once and cannot be recovered.
          </p>

          <p className="coupon-note">
            Redeem it from the vault with <strong>Add Credits → Add credit with coupon</strong>.
            Anyone holding this token can redeem it, so treat it like cash.
          </p>

          <button className="coupon-secondary" onClick={handleAnother}>
            Use another code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="coupon-page">
      <div className="coupon-card">
        <h1>Redeem a coupon</h1>
        <p className="coupon-subtitle">
          Enter a coupon code to get a token you can add to your account as credit.
        </p>

        {mintOpen === false && (
          <div className="coupon-closed">
            Coupon minting is closed right now. Check back later.
          </div>
        )}

        <form onSubmit={handleMint}>
          <input
            className="coupon-input"
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="COUPON CODE"
            autoComplete="off"
            spellCheck={false}
            disabled={mintOpen === false || minting}
            aria-label="Coupon code"
          />

          {error && <div className="coupon-error">{error}</div>}

          <button
            className="coupon-submit"
            type="submit"
            disabled={!code.trim() || minting || mintOpen === false}
          >
            {minting ? 'Minting...' : 'Get token'}
          </button>
        </form>
      </div>
    </div>
  );
}
