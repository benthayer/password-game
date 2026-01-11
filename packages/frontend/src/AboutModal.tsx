/**
 * About modal with information about the app.
 */

import './AboutModal.css';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="about-modal-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="about-modal-header">
          <h2>About</h2>
          <button className="about-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="about-modal-content">
          <section>
            <h3>What Is This?</h3>
            <p>
                This evolved from a proof of concept password memory system to a full blown secure storage system.
                It enables accessing sensitive information easily via recognition-based password memorization via 
                the custom interface.
            </p>
          </section>

          <section>
            <h3>The Problem</h3>
            <p>
              I built this to solve a specific problem. My entire digital life is mediated through 
              a password manager. This is a single point of failure with serious consequences:
            </p>
            <ul>
              <li>If I forget my master password, I'm locked out of everything</li>
              <li>I could lose access to critical accounts — email, phone, banking</li>
              <li>As a digital nomad, I have no way to securely store a physical recovery kit</li>
            </ul>
            <p>
              I tried memorizing everything, including my password manager's secret key. 
              My brain got so fried that I ended up forgetting even my master password. 
              I was only saved because I could still access my vault via biometrics on my phone.
            </p>
            <p>
              I also forgot the password to my recovery email — because I never used it. 
              This convinced me I needed a more reliable way to memorize information.
            </p>
          </section>

          <section>
            <h3>The Solution: Recognition Memory</h3>
            <p>
              The solution is <em>recognition-based memory</em>. It may seem intimidating to memorize 
              a 20-word password, but recognition memory is among the most reliable forms of memory 
              and degrades steadily rather than catastrophically. "Forgetting" means squinting a little harder
              and taking a little longer rather than forgetting completely.
            </p>
            <p>
              Instead of pure recall ("what is my password?"), you use recognition ("which of these 
              words is mine?"). The grid shows you options; you pick the ones you recognize. 
              This is far more reliable than trying to recall random words or characters from nothing.
            </p>
            <p>
              I tested this on myself: after practicing a password for only <strong>1 day</strong>, 
              I was able to reproduce it <strong>60 days later</strong> with only 4 intermittent 
              practice attempts. Now I use it as my primary fallback for both 1Password and my recovery
              email address.
            </p>
          </section>

          <section>
            <h3>How It Works</h3>
            <p>
              <strong>Password Generation:</strong> Hash functions are used to deterministically
              generate grids of words. Each word of the password is selected from the grid of available words.
              The next grid depends on the hash of the previous words + the other configuration details
              such as grid dimensions and a seed phrase.
            </p>
            <p>
              <strong>Practice Mode:</strong> Generating a password takes you to practice mode. 
              Practice mode has a UI designed to help you practice recognizing your words in the grid.
              It is designed to aid you just enough to help you learn, and you can select options to make
              the practice progressively harder until you're able to fully reproduce the password.
              You do not need to be able to freely recall the password, if you can do it via the recovery
              interface, you're good.
            </p>
            <p>
              <strong>Data Storage:</strong> Once you're able to reproduce your password,
              you are able to upload a file. Your password is hashed to create a storage address 
              and an encryption key. The data is encrypted client side, similar to end to end
              encryption. When you want to recover, the server
              will transmit the encrypted data back to your device and it will be decrypted locally using
              the encryption key generated from your password. The system is fully secure and the server never
              sees your unencrypted data. 
            </p>
            <p>
              <strong>Recovery Mode:</strong> When you want to access your stored information, all you
              have to do is enter your password + configuration details and click download. The file will
              be decrypted client-side and you will have access to your data. 
            </p>
          </section>

          <section>
            <h3>Security Model</h3>
            <p>
              Your password is hashed (Argon2id by default) to derive three values:
            </p>
            <ul>
              <li><strong>Address Hash:</strong> An identifier used to locate your data on the server.</li>
              <li><strong>Primary Encryption Key:</strong> Used to encrypt your data client-side before upload.</li>
              <li><strong>Secondary Encryption Key:</strong> Used to encrypt your data again server-side (See below)</li>
            </ul>
            <p>
              <strong>Why double encryption?</strong> Essentially, the server does not trust the client
              to send it unencrypted data. The server requires the client to send it a separate encryption key
              which will be used to encrypt the data again. The server encrypts your 
              already-encrypted data with the secondary key, then throws the key away. This is an added layer of security such that the 
              server is confident that it is not saving unencrypted information. The key is validated 
              to ensure that it is different from the original key by attempting to decrypt the file and rejecting the
              upload if the decryption works.
            </p>
            <p>
              <strong>What the server knows:</strong> The address hash, and the size of your encrypted data.
            </p>
            <p>
              <strong>What the server never knows:</strong> Your password, your primary encryption key, the contents of your data.
            </p>
            <p>
              <strong>What the server knows temporarily:</strong> Your secondary encryption key
            </p>
          </section>
        </div>

        <div className="about-modal-footer">
          <button className="about-modal-button" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

