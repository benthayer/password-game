# Password Game

## MVP

- [ ] Perform a thorough code review
- [ ] Encrypt disk using an ephemeral key
- [ ] Verify frontend encrypts
- [ ] Verify frontend decrypts
- [ ] Add simple text file support
- [ ] Deploy
- [ ] Upload 1Password recovery details + Google recovery account details
- [ ] Update interface to include estimated cost to crack in dollars (right now, 5 years, 10 years, 30 years, 50 years, 100 years)

---

## CYA

- [ ] Verify file encryption (randomness + other checks)
- [ ] Have client send over secondary encryption key
- [ ] Verify randomness of secondary encryption key
- [ ] Verify that the secondary encryption key does not decrypt the file
- [ ] Encrypt file again using secondary encryption key (as a sanity check to be sure that I don't have access)

## CYA++

- [ ] Zero knowledge proof that the password actually meets "uncrackable" security standards
- [ ] LLC
- [ ] Move server to friendly jurisdiction

## Payments

- [ ] BTC Lightning
- [ ] Other crypto
- [ ] Verifiable signatures + encrypted messages along with payments

## Full FOSS / Filecoin Integration

- [ ] Save encrypted file to Filecoin
- [ ] Save encrypted pointer to some other decentralized service
- [ ] Pointer name/address = 256 bit hash from password + fixed suffix, pointer contents = encrypted(filecoin address, 256 bit hash from password + a different fixed suffix)

