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
              then tries random passwords until they find a combination that unlocks someone's data. 
              In a dragnet attack, they're not targeting you specifically — they're fishing for anyone.
            </p>
            <p>
                The value of a dragnet attack depends on how much data is stored with the targeted configuration. 
                Attackers will target popular configs and if you're using a common config 
                without a salt, then you'll be in the net and might get caught.
            </p>
          </section>
          <section>
            <h3>Why This Matters</h3>
            <p>
              This system's API is <em>publicly accessible</em>. Anyone can attempt to access any data, but <em>without
               your password, they cannot find or decrypt your data</em>.
              There are no accounts, no rate limits, no gatekeepers, but with a <em>good
              password and configuration, your data will never be decrypted</em>.
            </p>
          </section>

          <section>
            
            <h3>How To Protect Yourself</h3>
            <p>There are three ways to protect yourself, in order of reliability:</p>
            <ol>
              <li>Use a salt</li>
              <li>Use a unique seed phrase</li>
              <li>Use a longer password</li>
            </ol>
          </section>

          <section>
            <h3>Why Salt Works</h3>
            <p>
              If you use a salt, dragnet attacks cannot affect you. Your salt is guaranteed to be unique to you, 
              which means an attacker would need to use <em>your specific salt</em> and attack you specifically.
            </p>
            <p>
              A targeted attack is still possible, but the cost (if you have a good password) makes it economically impossible. 
              We estimate this cost based on current hardware and electricity prices. The larger the cost, 
              the better. Since costs may decrease over time as technology improves, aim for an absurdly large 
              number — making it exceedingly unlikely that cracking your password will <em>ever</em> be 
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
              global economy is ~$100 trillion. A 17-word password currently costs roughly that much to crack.
              At that price, there is no way for it to be economically feasible to decrypt your data, even in a dragnet.
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

