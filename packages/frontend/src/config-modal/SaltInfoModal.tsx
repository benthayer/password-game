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
            <p>There are three ways to protect yourself against a dragnet attack:</p>
            <ol>
              <li>Use a longer password or more expensive hash function</li>
              <li>Use a salt</li>
              <li>Use a unique seed phrase or configuration (sorta)</li>
            </ol>
          </section>

            <section>
            <h3>Why Using A Longer Password Or More Expensive Hash Function Works</h3>
            <p>
                Password length and hash function type and parameters are both ways to tune how costly it is to crack
            your password.
                A sufficiently long password or computationally expensive hash function can make dragnet
                attacks uneconomical. 
                
            </p>
            <p>
                For example, a 17-word password with the default hash 
                function (argon2id) currently costs roughly the same amount of money to crack as the entire world economy - $100 trillion.
                At that price, there is no way for it to be economically feasible to decrypt your data, even in a dragnet.
                
            </p>
            </section>

          <section>
            <h3>Why Using A Salt Works</h3>
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
            <p>
                It makes sense to use a salt when you want your password to be shorter and you will reliably 
                be able to store the salt and access it when you need it. 
            </p>
            <p>
              Remember - if you lose the salt (or any other configuration details), you lose your data.
            </p>
          </section>

          <section>
            <h3>Why Using A Unique Seed Phrase Or Configuration Helps</h3>
            <p>
              A dragnet attack is all about the total value of the data with the same configuration. 
              By using a unique or uncommon seed phrase or other configuration values (like grid dimensions or hash function),
              there will be fewer people who share that same configuration.
              However, this option is worse because you cannot <em>guarantee</em> how many other people will share
              your configuration. The value of the attack is proportional to the number of people using the 
              shared configuration. This is not recommended to be your primary defense.
              It is better to just use a salt or a stronger password.
            </p>
          </section>
          <section className="salt-info-recommendation">
            <p>
              <strong>Recommendation:</strong>
            </p>
            <p>
              Use all defaults. Do not use a salt and instead use a password that costs ≥$100T to crack.
            </p>
            <p>
              This system is designed to make memorizing passwords easy. A strong password makes dragnet
              attacks irrelevant. If you use a salt, or custom config, there is a risk of losing or miscopying
              it and being unable to gain access to your data. The best way to use this system it to take advantage
              of the easy memorization and remove the hassle of finding your configuration values when trying
              to retreive your data.
            </p>
            <p>
              If you do use a salt or custom configuration, write every detail down. This includes the seed phrase, the
              grid configuration, the salt, and the hash function.
              This information needs to be accessible to you when you recover your information.
              The risk of making it private is that you will not be able to access it when you need it.
              The risk of making it public is that other people may know you have data stored on this system.
            </p>
            <p>
                If you do choose a custom config, the ideal is to write down information in a way that's
                minimally publicly visible while still being accessible to you.
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

