# Connecting getperfectspin.com — DNS Setup Guide

This covers what Cassie needs to do to point her domain, `getperfectspin.com`, at her Perfect Spin site. There are two ways to do it — she can either follow the steps herself, or grant JB access to make the changes for her. Both are below.

**Note:** The exact DNS records to enter (the A/CNAME values) will be provided once the domain is added on the hosting side. This guide covers the process; the specific values come next.

---

## Option 1: Cassie does it herself

1. Go to [account.squarespace.com/domains](https://account.squarespace.com/domains) and log into the account that owns `getperfectspin.com`.
2. Click on the domain name in the list.
3. Click **DNS** in the side panel.
4. To edit an existing record, hover over it and click the pencil icon. To add a new one, use the add-record option on the same page.
5. You'll be asked to confirm your password or two-factor code before changes are allowed.
6. Enter the record details (Type, Name, Priority/TTL, Data) exactly as provided.
7. Save the record.
8. DNS changes can take **24–48 hours** to fully propagate, though it's often much faster.

---

## Option 2: Cassie grants JB (or another developer) access to make the changes

This lets someone else manage DNS without ever seeing her login or billing info.

1. Go to [account.squarespace.com/domains](https://account.squarespace.com/domains) and log in.
2. Click on the domain name (`getperfectspin.com`).
3. Click the **Permissions** tab.
4. Click **Invite domain manager**.
5. Enter the name and email address of the person being invited (e.g. JB).
6. Send the invite — they'll get an email with a link to accept.
7. Once accepted, that person can manage DNS records and connect the domain to a site.

**What a domain manager CAN do:**
- Manage DNS records
- Connect the domain to a website
- Add or remove other domain managers

**What a domain manager CANNOT do:**
- See or touch billing/auto-renew
- Delete the domain outright

This is the safer option if she'd rather not touch DNS settings herself — it hands over just enough access to get it connected, nothing more.

---

## Important — timing matters

Please don't update the DNS records until you're told the domain has been added on the hosting side first. Pointing DNS too early would send visitors to the wrong site instead of Perfect Spin. Once that step is done, the actual record values (A/CNAME) will follow.
