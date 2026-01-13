Accounts get two variables
- gigabyte years remaining
- egress gb remaining

Everything is billed directly against this
There are no logs
Small files are treated as 1 gigabyte for the pricing model

Operations
Payment
- $1 means add 1 gigabyte year and add 50 gigs egress
Upload
- set file size
Download
- subtract from egress gb remaining
Delete file
- subtract one day from storage, as if nightly cron ran
- set file size to zero or null (tbd)
Nightly billing cron
- subtract max(1gb, file size) / 365 from gigabyte years remaining