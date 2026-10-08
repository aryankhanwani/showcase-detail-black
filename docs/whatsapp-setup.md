# Connecting Meta — WhatsApp Cloud API

Everything in this document is configuration. No code changes are needed; the
integration is already built and goes live the moment these values are present.

There are two separate things to switch on, and they fail for different reasons:

| What | Needs | Fails without it |
| --- | --- | --- |
| **Inbound** — a customer messages the studio and the assistant replies | token, phone number id, app secret, webhook | the webhook returns 401 or Meta never calls it |
| **Outbound** — a booking confirmation goes out unprompted | an **approved message template** | error 131047, "message outside the 24-hour window" |

The second one is the one that surprises people. Read §4 before going live.

---

## 1. The app and the number

1. **developers.facebook.com → My Apps → Create App.** Type: *Business*.
2. In the app, **Add product → WhatsApp → Set up.**
3. The **API Setup** page now shows you everything in §2.

While you are testing, Meta gives you a free **test number** and a **temporary
token** (24 hours). You may message up to five recipient numbers, which you add
on the same page under *To*. No business verification is needed for this.

Going live means adding your own number under *Phone numbers → Add phone
number*, verifying the business, and generating a permanent token (§2).

---

## 2. The four values

Put these in `.env.local` locally, and in your host's environment variables in
production (Vercel → Project → Settings → Environment Variables). Restart after
changing them — they are read at request time but the server caches the module.

```sh
WHATSAPP_PHONE_NUMBER_ID=      # API Setup -> "Phone number ID". Digits. NOT the phone number.
WHATSAPP_TOKEN=                # API Setup -> temporary token, or a System User token (below)
WHATSAPP_APP_SECRET=           # App settings -> Basic -> App secret -> Show
WHATSAPP_VERIFY_TOKEN=         # A random string you invent. Any value. Keep it secret.
```

`WHATSAPP_VERIFY_TOKEN` is not issued by Meta — you make it up, put the same
string in both places, and it is how the webhook proves the subscription request
came from you. Generate one with `openssl rand -hex 16`.

### A token that does not expire

The token on the API Setup page dies after 24 hours. For anything but a first
test:

1. **business.facebook.com → Business settings → Users → System users → Add.**
   Name it something like `aurum-whatsapp`, role **Admin**.
2. **Add assets →** your app and your WhatsApp account, with *Manage* on both.
3. **Generate new token →** pick the app, select the scopes
   `whatsapp_business_messaging` and `whatsapp_business_management`, set
   expiry to **Never**.
4. That is `WHATSAPP_TOKEN`.

---

## 3. The webhook

The webhook is what delivers the customer's messages to the site. It is already
implemented at `src/app/api/whatsapp/route.ts`.

**URL** — `https://your-domain.com/api/whatsapp`

1. **App → WhatsApp → Configuration → Webhook → Edit.**
2. Callback URL: the URL above. Verify token: your `WHATSAPP_VERIFY_TOKEN`.
3. Click **Verify and save.** Meta immediately `GET`s the URL; the route answers
   the challenge. If this fails, the token does not match or the deployment is
   not live yet.
4. **Webhook fields → Manage → subscribe to `messages`.** This is the step
   people miss. Without it the webhook verifies and then never fires.

### Testing it locally

Meta cannot reach `localhost`, so tunnel:

```sh
bunx ngrok http 3000
# then use the https URL + /api/whatsapp as the callback URL
```

The signature check in `verifySignature` runs on every request, so
`WHATSAPP_APP_SECRET` must be set locally too or every delivery answers 401.

---

## 4. The booking confirmation — read this one

When a booking is finalised in the chat, `src/lib/booking.ts` sends the customer
a WhatsApp receipt. **This message is outbound to someone who has not messaged
you**, which WhatsApp calls a *business-initiated* conversation, and plain text
is not allowed there. It only works inside 24 hours of the customer's own last
message. Outside that window Meta rejects it:

```
(#131047) Re-engagement message: Message failed to send because more than
24 hours have passed since the customer last replied to this number.
```

The fix is a **template**, which is pre-approved text with blanks in it.

### Create the template

**business.facebook.com → WhatsApp Manager → Message templates → Create.**

- **Category**: `Utility` — *not* Marketing. Utility templates are for
  transactional messages like this one, they are cheaper, and they are approved
  in minutes rather than days.
- **Name**: `booking_confirmation` (lowercase, underscores only)
- **Language**: English
- **Body** — paste exactly this:

```
Hi {{1}}, your drop-off at AURUM Detail Studio is confirmed.

Reference {{2}}
{{3}}
{{4}} · {{5}}

Survey 118, Sardar Patel Ring Road, Bopal, Ahmedabad 380058

The exact figure comes after the inspection on the day. Reply here to move the date, or call {{6}}.
```

- Meta asks for **sample values** for each variable. Use:
  `Aryan`, `AUR-7Q2K4M-B`, `Monday, 12 October, 11:00 AM`, `Ceramic Coating`,
  `2022 Creta`, `+91 98250 41200`

The variable order is not cosmetic. It is set in `notify()` in
`src/lib/booking.ts`:

| Variable | Value |
| --- | --- |
| `{{1}}` | customer's first name |
| `{{2}}` | booking reference |
| `{{3}}` | date and drop-off window |
| `{{4}}` | service |
| `{{5}}` | vehicle |
| `{{6}}` | studio phone |

**Changing the order in WhatsApp Manager without changing it in `booking.ts`
sends a customer somebody else's date.** They are two halves of one thing.

### Then switch it on

```sh
WHATSAPP_BOOKING_TEMPLATE=booking_confirmation
WHATSAPP_TEMPLATE_LANG=en
```

Approval usually takes a few minutes for a Utility template. Until it is
approved, leave the variable blank: the code falls back to plain text, which is
enough to test the whole flow against Meta's test number — and is exactly the
thing that will stop working in production.

### The studio's own alert

Optional. A "new booking" message to a person at the studio:

```sh
WHATSAPP_STUDIO_ALERT_TO=9825041200   # a human's number, 10 digits
WHATSAPP_ALERT_TEMPLATE=booking_alert # optional; falls back to plain text
```

It has to be a person's number. A WhatsApp business number cannot send a
message to itself, so pointing this at the studio's own number silently fails.

---

## 5. Checking it works

```sh
# 1. Webhook verification — should print your challenge value back
curl "https://your-domain.com/api/whatsapp?hub.mode=subscribe\
&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=hello"
# -> hello

# 2. Unsigned POST — should be refused
curl -X POST https://your-domain.com/api/whatsapp -d '{}'
# -> 401 Bad signature
```

Then, end to end:

1. Message the studio's WhatsApp number from a whitelisted phone. The assistant
   replies within a few seconds, already knowing the car if that number has
   filled in the form before.
2. Ask it about price. A written price block comes back — the same figures the
   website card shows, from `src/content/studio.ts`.
3. Ask to book. A tappable list of open dates arrives, then one of drop-off
   windows, then the receipt. No typing a date, nothing parsed out of prose.
4. Make a booking on the website instead. The same receipt arrives on WhatsApp —
   this is the path that needs the template.

### When something is wrong

| Symptom | Cause |
| --- | --- |
| Webhook verification fails | `WHATSAPP_VERIFY_TOKEN` differs between Meta and the server, or the deploy is not live |
| Webhook verifies, nothing arrives | not subscribed to the `messages` field (§3.4) |
| Every delivery 401s | `WHATSAPP_APP_SECRET` missing or wrong |
| Replies never send, logs show 401 | token expired — the API Setup token lasts 24 hours (§2) |
| `131047` | outside the 24-hour window. You need the template (§4) |
| `132001` | template name or language does not match what is approved |
| `131026` | recipient not on the test number's allow-list, or not a WhatsApp user |
| Receipt never arrives, booking exists | by design. `notifyError` on the `bookings` row holds the reason |

The failure is kept rather than thrown: a booking is not lost because WhatsApp
was unreachable. The chat says so on the receipt card, and the row records why.
