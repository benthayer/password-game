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
                The basic idea behind the platform is that your key is the source of truth and should be uncrackable.
                The password is expected to be strong enough to be crack-resistant and is relied upon for
                the entirety of the security model to work.
            </p>
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

          <section>
            <h3>Failure Modes & Attack Vectors</h3>
            <p>
              <strong>What this system doesn't protect against</strong>
            </p>
            <ul>
              <li>The server operator (me) and data storage provider (Backblaze) can access encrypted data and address hashes</li>
              <li>Anyone can poll the server to test for the existence of any address hash</li>
              <li>If someone has your address hash, they can download your encrypted data</li>
              <li>If someone has your address hash, and knows or guesses your configuration, they can use it to attempt to crack your password</li>
              <li>Once someone cracks your password, they will have your encryption keys and be able to read your data</li>
            </ul>
            <p>
              <strong>Positive considerations</strong>
            </p>
            <ul>
              <li>Encrypted data is only discoverable by knowing the exact hash, which is impossible without either cracking passwords, snooping or hacking some other way</li>
              <li>The client doesn't leave any traces on the user's device, limiting the attack surface just to the moments when the user is using the recovery or practice interface</li>
              <li>If your password is strong enough, it is not possible to derive your password or encryption key from your address hash</li>
            </ul>
            <p>
              <strong>The Attack Vector:</strong> There is essentially one attack vector for the system. 
              An attacker would select a configuration and iterate over passwords, poll the server to 
              test if the address hash exists, and if so, download the encrypted blob and decrypt the 
              data using the encryption keys they can generate from the password. This comes in two flavors:
            </p>
            <ul>
              <li><strong>Targeted:</strong> The attacker obtains the target's configuration details 
              and iterates through passwords, polling to find a match. If they find a match, they have 
              your data. With a strong password, this is economically infeasible — the estimated cost 
              is shown in the configuration.</li>
              <li><strong>Dragnet:</strong> Same as above, but the attacker selects the default 
              configuration and hopes that someone misconfigured. Using a salt or unique configuration 
              protects against this.</li>
            </ul>
            <p>
              Other security considerations:
            </p>
            <ul>
              <li><strong>Rate Limiting:</strong> The server caps total request throughput with one shared
              budget for all traffic (per-IP limiting applies only to coupon minting). This bounds load on
              the server, but it does not isolate one client from another, so you should assume it's possible
              for an attacker to check if a given hash exists. If an attacker finds a hash, it's very likely
              because they cracked a weak password.</li>
              <li><strong>Information Leakage:</strong> The system is designed such that the risk of leaking 
              information is extremely minimal. Even if the client communicated with the server over plain 
              HTTP, this would still not leak enough information to compromise your data. The only way for 
              an attacker to compromise your data is to run a full password crack attempt or hack your 
              computer/browser directly.</li>
              <li><strong>Data Breach Impact:</strong> A server data breach is minimally useful to an attacker — 
              the only benefit would be that they can now run the same attacks offline rather than polling 
              the server. The encrypted data itself reveals nothing.</li>
              <li><strong>Anonymity:</strong> There are no accounts and no usernames — an attacker looking at
              the database sees encrypted blobs and hashes, with no way to know what they contain. But
              "no metadata" would be too strong a claim: timestamps and network metadata do exist, and they
              are covered honestly in the next section.</li>
            </ul>
          </section>

          <section>
            <h3>Privacy: What Actually Leaks</h3>
            <p>
              The encryption above is the strong part. This section is about what's left over — who you are
              on the network, and when you did things. It's weaker, and you should read it before trusting
              this service with anything that matters.
            </p>
            <p>
              <strong>You cannot verify any of this.</strong> Everything here is a claim about a server you
              don't control, made by the person who runs it. You have no way to check that the configuration
              I describe is the one that's running, that I haven't changed it since, or that nobody with more
              leverage than you has asked me for something. "I don't log your IP" isn't a security property —
              it's a promise, and promises are what the rest of this project tries hard not to rely on.
            </p>
            <p>
              <strong>So: use a VPN, or Tor.</strong> Not because I think I'm untrustworthy, but because it
              makes the question moot. If the IP arriving at my server isn't yours, it doesn't matter what I
              log, what my hosting providers log, or what either of us is later compelled to hand over. That's
              something you can verify yourself, which makes it worth more than anything I can tell you.
            </p>
            <ul>
              <li><strong>IP addresses:</strong> What I control, I've turned off — the web server for this app
              and its API is configured to write no access log and no error log, including on the plain-HTTP
              redirect, and the application itself never reads or stores your IP. What I don't control is my
              VPS provider, which can see all traffic to the machine regardless of what my software does.</li>
              <li><strong>Your network sees where you went:</strong> TLS hides the URL and the payload, but the
              DNS lookup and the TLS server name still tell your ISP and any network in between that you
              visited Password Game, and when. My own nameservers don't log queries, but your resolver does
              the work either way — this is the leak a VPN actually fixes.</li>
              <li><strong>Paying is the biggest link:</strong> Stripe and Coinbase see your IP directly, plus
              whatever else a card reveals about you. That checkout page is theirs, not mine. Crypto payments
              additionally record the sending wallet next to your account. Coupon codes exist partly as a path
              that avoids all of this.</li>
              <li><strong>Timestamps exist, and downloads are counted:</strong> Each address hash has a
              creation time, a last-updated time that is rewritten on <em>every download</em>, and an exact
              file size. Because egress credits are deducted per fetch, the remaining balance reveals roughly
              how many times a blob has been downloaded. Correlating those times with anything else you did is
              the realistic way to deanonymize you here, and a VPN does not help with it.</li>
              <li><strong>Deleting is not erasing:</strong> Blobs are stored in Backblaze B2 under your address
              hash as the object key, so the storage provider holds that hash, the upload time, and the exact
              size. The bucket also retains prior versions behind delete markers — I checked, and objects from
              months ago are still recoverable there. Treat deletion as "no longer served," not "gone."</li>
            </ul>
            <p>
              The honest summary: use a VPN or Tor, prefer a coupon over a card if payment linkage matters,
              assume your upload and download times are recorded, and don't rely on delete meaning erased. The
              encryption is the part you can check for yourself by reading the client. Everything in this
              section is the part where you'd be trusting me — which is exactly why you shouldn't have to.
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

