/**
 * Info modal explaining salt and dragnet attacks.
 */

import './SaltInfoModal.css';

interface SaltInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SaltInfoModal({ isOpen, onClose }: SaltInfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="salt-info-overlay" onClick={onClose}>
      <div className="salt-info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="salt-info-header">
          <h2>Understanding Salt & Security</h2>
          <button className="salt-info-close" onClick={onClose}>×</button>
        </div>
        
        <div className="salt-info-content">
          <section className="salt-info-recommendation">
            <strong>Recommendation:</strong> Enable salt and make your configuration details easily accessible. 
            The salt is not a secret — it just needs to be unique to you.
          </section>

          <section>
            <h3>Understanding Dragnet Attacks</h3>
            <p>
              In this system, hashes are used to locate and encrypt your data. In a <strong>dragnet 
              (multi-target) attack</strong>, an attacker picks a seed phrase and grid configuration, 
              then tries random passwords until they find a combination that unlocks <em>someone's</em> data. 
              They're not targeting you specifically — they're fishing for anyone.
            </p>
            
            <p><strong>Three ways to protect yourself (in order of reliability):</strong></p>
            <ol>
              <li><strong>Use a salt</strong> (strongest)</li>
              <li><strong>Use a unique seed phrase</strong></li>
              <li><strong>Use a longer password</strong></li>
            </ol>
          </section>

          <section>
            <h3>Why Salt Works</h3>
            <p>
              If you use a salt, dragnet attacks cannot affect you. Your salt is guaranteed to be unique, 
              which means an attacker would need to use <em>your specific salt</em> — making it a targeted 
              attack, not a dragnet.
            </p>
            <p>
              A targeted attack is still theoretically possible, but the cost makes it economically impossible. 
              We estimate this cost based on current hardware and electricity prices. The larger the number, 
              the better. Since costs may decrease over time as technology improves, aim for an absurdly large 
              estimate — making it exceedingly unlikely that cracking your password will <em>ever</em> be 
              economically feasible.
            </p>
          </section>

          <section>
            <h3>Why Unique Seed Phrases Help</h3>
            <p>
              Similar logic applies to unique seed phrases and grid configurations. However, unlike salt, 
              you cannot <em>guarantee</em> uniqueness — you can only estimate how unique it is. An attacker 
              could still run a dragnet against all users sharing your configuration, but the payoff is 
              limited by how many targets exist and the value of their data.
            </p>
          </section>

          <section>
            <h3>Why Long Passwords Help</h3>
            <p>
              A sufficiently long password can make even dragnet attacks uneconomical. For example, the 
              global economy is ~$100 trillion. A 17-word password costs roughly that much to crack. Unless 
              the combined value of all data caught in a dragnet exceeds the global economy, no rational 
              attacker would attempt it.
            </p>
          </section>
        </div>

        <div className="salt-info-footer">
          <button className="salt-info-button" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

