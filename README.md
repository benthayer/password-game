# Password Game

Password Game is two things
1. A way to create passwords that are hard to forget
2. A file storage server

## How It Works - Simple Version

Password Game is built on the principle that recognition is easy while free recall is hard. Your password is embedded in a determinstically generated sequence of grids. You practice your password using the interface and recall becomes easy because once you've practice, you've gained familiarity with the words and now recovery means finding the next word in an interface. Recognizing the word from a small set of options is far easier than free recall. With free recall, it's possible to entirely forget your password, with absolutely no recovery mechanism.

Additionally, wired up to the interface is a file storage system. You can use your password to save and encrypt a single file, which can be useful for purposes of disaster recovery or simply having access to that file in a way that's decorrelated from your other accounts. I do not have access to your file contents. It's encrypted with keys derived from the password, and the primary encryption key stays client side. There is also a secondary encryption key that I use to encrypt the file again on my server so that I have a more robust guarantee that I cannot see your data. This is irrelevant for you because your data is already encrypted, but it's relevant for me because I want to be sure that the data is encrypted with a key that I don't have access to. I encrypt the file again server side with the second key and then toss out the key to ensure I don't have access.

## Example Use Cases

The primary intent is to be used as a fully decorrelated/airgapped disaster recovery path.

Scenario 1:
You're alone in a foreign country and lose access to all of the physical devices that you own. You need a way to quickly and easily get back online. You need access to money and possibly additional unmemorizable credentials, so you store a crypto wallet with $1500 and your password manager's recovery kit.

Scenario 2:
Your password manager and primary email are both single points of failure. You need access to your password manager to get access to your email, and you need to protect yourself against forgetting your master password, losing your password manager's secret key, and someone else changing your email password, so you create an airgapped email whose password is not saved in your password manager and set it as your recovery email, then you store the recovery email's password and your password manager recovery kit. Storing the recovery email password ensures that you have reliable airgapped access to the recovery email while storing your password manager's recovery kit ensures that you're robust against forgetting your password or losing the devices with access to your secret keys.

Scenario 3:
You just want a long password with a way to recover it if you forget. You use the interface to generate and practice a password, and then if you ever forget the password, you come back to the interface and use it to help prompt your recall.

## Crypto

### Crypto - Grid and Password Generation

See `packages/frontend/src/crypto-utils.ts` for specifics

At a high level, the model is this

- generate password = select next word n times
- next word = use random bytes, masking and rejection sampling to select the index of the next word in the grid
- grid words = hash the config, password prefix, row, and column, then take the result mod the length of the word list to get the index of the word for the row and column

#### Entropy

The password is constrained to only the options displayed in the grid, therefore the grid size is the source of the entropy rather than the word list. This means that passwords need to be longer to compensate. For a 4x4 grid, the entropy per word is 4 bits. [Proton.me](https://proton.me/blog/what-is-password-entropy) recommends 75 bits for a strong password. For 80 bits on a grid size of 4x4, this means 20 words. The formula is log2(rows * columns) * words.

### Crypto - Data Storage

See `packages/frontend/src/vault/vault-crypto-streaming.ts` for specifics

At it's core, the model is this
- signing keypair = ed25519 keypair seeded from hash(config + password + ':signing-key')
- address = the signing public key
- primary encryption key = hash(config + password + ':primary-key')
- secondary encryption key = hash(config + password + ':secondary-key')
- data you send to me = encrypt(file, primary encryption key)
- data I store = encrypt(data you send to me, seconary encryption key)
- every request = signed with the signing key, so the address alone is not a capability


## Memory fidelity

Per my testing, this system works remarkably well. Basically, after a single 15 minute session, it is possible to permanently recall a password. The hard data is that I learned a 25 word password in a single session, didn't practice for 9 months, and I was still able to recall it.

An easy way to test for yourself is to visit the site, generate a password, spend the 15 minues or so to get comfortable with the password, and then wait a few hours or days and see if it sticks. My recommendation is that if you can do the whole password in about 20 seconds, then that's good enough to be sticky, but if you're using this for a real purpose, I would try to get to the point where you know every item cold and have no felt sense of being unsure about any single word or grid location before deciding you know it enough. If you're going to use the system for storage, I would recommend practicing the password over the course of 2-3 days before storing anything just to be sure you got it down, but practically, this is not super necessary since the system is designed to make recall extremely easy.


For the specfics of the test I ran for myself:
- November 3rd, 2025: I finished v1 and learned a 25 word password
- November 3 - January 6: I intentionally did not practice my password
- January 7, 2026: I tested again, had full recall
- January 8 - July 31: I intentionally did not practice my password
- August 1, 2026, after ~7 months with absolutely zero contact with the password: Still have full recall.

## Misc Security Considerations

### Beware Entropy

There is a section on entropy above, but it's important to know that despite long passwords, the entropy per word is very low. Make sure that your password is long and has enough entropy.

### The Config Is Public

The system gives you a config file containing your salt and other information. You should store this somewhere public and accessible. The salt and configuration info is not a secret and is necessary to recover your password (and files). 

### Your Account Is Your Hash Address

Your account consists only of your address, which is an Ed25519 public key derived from your password. There is no way to link an email, a username or anything else. Every operation (download, upload, delete, account info) must be signed with the corresponding private key, which is derived from your password and never leaves your device — so knowing the address grants no capabilities at all. The server stores no credentials: a full database leak reveals only addresses, balances, and encrypted blobs, none of which can be used to read or destroy anything.

### The Hashing Algorithm is Argon Where It Counts

For generating the grid deterministically, SHA-256 is used, but the signing keypair (and therefore your address) is derived through Argon2. This prevents people from being able to brute force your password from the address since Argon is a hashing algorithm specifically designed to be difficult for brute forcing. Using SHA-256 for the grid generation is not a problem because it is only ever used client-side and the server only ever sees the Argon-derived public key, which is the relevant thing for security.

### Dragnet/Rainbow Table Attacks

If you decide not to use a salt, you are exposed to a dragnet attack, which is roughly the same as a rainbow table attack. The reason I don't call it a rainbow table attack is because there is no rainbow table that exists in relation to this system, but the same principle applies that multiple people can be affected by the same attack if they're not using a salt. The way the attack works on this system would be that the attacker systematically enumerates all possible passwords in order of increasing length. If multiple people are not using salts, then that means that it is possible for enumeration to hit multiple people. For a long enough password, this is still not economically feasible, but since the attacker could obtain the data of multiple targets, it makes it a more worthwhile attack to run.

Concrete example:
You and I both have a trivially crackable length 4 passwords based on a 4x4 grid and no salt. Because enropy is related to the grid size and the password length, the total entropy is log2(4 x 4) x 4 = 16 bits = 65k possibilities. We both store $1000 in a crypto wallet. An attacker decides to enumarate all length 4 passwords. The value of this attack is $2000. If instead I used a salt and the attacker chose to target me, the vaule of the attack is now $1000 because he is limited to the people using my salt, which is just me and my one file. If I use a different salt per file I want to store, then the attacker has to choose which to target rather than being able to target all of my files at once. If there are 1000 users with length 4 passwords all storing $1000, then the value of the attack is $1,000,000 while if each user had used a salt, then the attacker has to pick a target user and the value of the attack is only $1,000.

## Development

Run everything locally (frontend on :3000, backend on :3001):

    npm install
    npm run dev

### Running the client yourself

If you don't want to trust the hosted frontend, you don't have to. Run the client from this repo — code you can read — pointed at the production backend:

    npm run client

This serves the frontend from local source on http://localhost:3000 with `VITE_API_URL=https://api.passwordgame.apps.benthayer.com`, so you're using the real service while knowing exactly what code is handling your password. The backend allows cross-origin requests (`Access-Control-Allow-Origin: *`), so this works with no extra setup.

The encryption design means that you don't need to trust the backend for your data to be secure. The data is encrypted before being sent and the backend never sees your private key or primary encryption key.

## API

If you want to set up a terminal UI or do your own integration with my backend, you can. Here are the endpoints that I provide.

### Authentication

The address is a hex-encoded Ed25519 public key. Every account and blob request must carry three headers proving possession of the corresponding private key:

    X-Auth-Timestamp — unix seconds
    X-Auth-Nonce — 16 random bytes, hex-encoded (32 chars)
    X-Auth-Signature — hex-encoded Ed25519 detached signature over the string "{timestamp}:{nonce}"

The timestamp must be within 5 minutes of server time, and each nonce is single-use. If your clock is off, the 401 response includes serverTime so you can correct and retry. Payment endpoints require no authentication — anyone may add credits to an address.

### Account

#### GET /account/:address
Check account status and balances.

Returns:

    gbYearsRemaining — storage credit remaining
    egressGbRemaining — download bandwidth remaining
    fileSize — size of stored file (null if none)
    exists — boolean, whether a file exists at this address
    verificationMessage — string for payment verification (payment:{address})

### Blob Storage

#### GET /blob/:address
Download the encrypted blob at this address. Charges egress credits based on file size. Returns 402 if insufficient egress, 404 if no file exists.

#### PUT /blob/:address
Upload an encrypted blob.

Required headers:

    Content-Length — size of encrypted payload
    X-Secondary-Key — hex-encoded secondary encryption key

Returns 402 if insufficient storage credits, 409 if file already exists at address.

#### DELETE /blob/:address
Delete the blob at this address.

### Payments

Privacy note: the address is never sent to the payment provider. The server generates a random token, maps it locally to the address, so the payment provider has no way to correlate the payment to your blob address.

#### POST /payments/create-charge
Create a cryptocurrency payment via Coinbase Commerce.

Body: { address: string, amountUsd: number (1-100) }

Returns: { chargeUrl, chargeId, chargeCode }

Redirect chargeUrl to complete payment. The chargeUrl is a hosted Coinbase page where the user picks their crypto and pays. Once confirmed, a webhook credits the account.

#### POST /stripe/create-checkout
Create a card payment via Stripe Checkout.

Body: { address: string, amountUsd: number }
Amount must be between 1 and 100.

Returns: { checkoutUrl, sessionId }

Redirect checkoutUrl to complete payment. The checkoutUrl is a hosted Stripe page where the user enters their card details and pays. Once confirmed, a webhook credits the account.

## Self-Hosting

If you don't want to depend on me at all, run the whole thing yourself. Everything in this repo is what I run in production. There are two services:

- **frontend** — a static bundle served by nginx. No server-side logic, no secrets.
- **backend** — a Node/Express server that keeps accounts in SQLite (local disk) and encrypted blobs in an S3-compatible bucket.

The only external dependency you actually need is object storage. Payments, the admin API, and the ops bot are all optional and the server starts fine without them.

### Configuration

The backend loads `.env`, then `.env.local` on top of it (local overrides win). `docker-compose.yml` reads `env_file: .env`, so for a Docker deploy put your values there. Nothing is committed — `.env*` is gitignored.

Storage (required):

    B2_KEY_ID       — S3 access key id
    B2_KEY          — S3 secret key
    B2_BUCKET       — bucket name
    B2_ENDPOINT     — defaults to https://s3.us-east-005.backblazeb2.com

The names say B2 because that's what I use, but it's the plain AWS S3 SDK, so any S3-compatible endpoint works (MinIO, Garage, S3 itself). One caveat: the region is pinned to `us-east-005` in `packages/backend/src/storage/b2.ts`. Backblaze ignores it, but if your provider signs against a real region you'll need to change that line.

Billing (optional):

    DISABLE_CREDIT_CHECK=true    — skip all credit accounting

Set this if you're running an instance for yourself or a few people and don't want to sell storage. Uploads and downloads become unlimited and free, and you can ignore Stripe, Coinbase, and the nightly billing job entirely.

If you do want billing, supply whichever provider you use:

    STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
    COINBASE_COMMERCE_API_KEY, COINBASE_COMMERCE_WEBHOOK_SECRET

Point Coinbase's webhook at `/webhooks/coinbase` and Stripe's at `/webhooks/stripe`. You can configure one provider and not the other — an unconfigured provider only fails its own create-payment endpoint (a 500), and the rest of the server is unaffected. If you configure neither, don't expose the credit-purchase UI, because both buttons will fail.

Everything else (optional):

    ADMIN_SECRET             — enables /admin; unset means /admin returns 404
    TELEGRAM_BOT_TOKEN       — ops bot, disables itself if unset
    TELEGRAM_ADMIN_CHAT_ID   — chat the bot will talk to
    PORT                     — default 3001
    DATA_DIR                 — default ./data (SQLite lives here)
    TEMP_DIR                 — default ./data/temp (in-flight uploads)

### With Docker

    docker compose up -d --build

Before you build, change `VITE_API_URL` in `docker-compose.yml` to your own API hostname. It's a build arg, not a runtime variable — Vite compiles it into the bundle, so a frontend built with my URL will keep talking to my backend no matter what environment you set later.

Both containers bind to loopback only (frontend on `127.0.0.1:48607`, backend on `127.0.0.1:48608`), on the assumption that you're terminating TLS in front of them. Put your own reverse proxy over the top; the backend already trusts one proxy hop for `X-Forwarded-For`, and it sends `Access-Control-Allow-Origin: *` so the frontend doesn't need to share an origin with it.

Account data is persisted through the `./data` bind mount at the repo root. That directory is the thing to back up — blobs live in your bucket, but the SQLite database holding addresses, balances, and file sizes is only on that disk.

`TZ` defaults to `America/Bogota` because absolute dates in the Telegram bot's `/stats` queries are resolved in local time. Set it to your own zone.

### Without Docker

Backend:

    npm install
    npm run build:backend
    cd packages/backend && node dist/index.js

Run it from `packages/backend`. That's also where your `.env` needs to live, since dotenv and the default `DATA_DIR`/`TEMP_DIR` paths are all resolved relative to the working directory — only the Docker path reads the `.env` at the repo root.

Frontend:

    VITE_API_URL=https://api.example.com npm run build:frontend

That writes a static bundle to `packages/frontend/dist` — serve it with anything. If you use your own web server config rather than the provided `nginx.conf`, two things there matter: unknown paths need to fall through to `index.html` for client-side routing, and `index.html` itself must not be cached, or browsers will keep asking for hashed bundles that a later deploy deleted.

### Operating an instance

If you left credit checks on, run the billing job once a day. It's idempotent, so a missed night is charged the next time it runs:

    node dist/services/nightly-billing.js        # from packages/backend, in a built image
    npm run nightly-billing -w packages/backend  # from a checkout with dev deps

To hand out credit without taking a payment, use the admin API with `ADMIN_SECRET` set:

    curl -X POST https://api.example.com/admin/credits \
      -H "Authorization: Bearer $ADMIN_SECRET" \
      -H "Content-Type: application/json" \
      -d '{"addressHash":"<address>","amount":5}'

`amount` is in dollars, on the same scale as a real payment: $1 grants 1 GB-year of storage and 50 GB of egress. `GET /admin/accounts` lists every account, and `GET /admin/accounts/:addressHash` shows one.

### A note on trust

Self-hosting the backend does not buy you much security, because the design already assumes the backend is hostile: files are encrypted client-side with a key derived from your password, requests are signed with a private key that never leaves your device, and the server only ever sees an Ed25519 public key and a ciphertext. What self-hosting actually buys you is availability and independence — your recovery path doesn't disappear if I lose interest, and nobody can meter or delete your blob but you. If your concern is specifically the code handling your password, the frontend is the part that matters, and you can address that without running any infrastructure at all — see "Running the client yourself" above.

