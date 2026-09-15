---
title: Verifier
sidebar_position: 1
---

## **🕵️ Verifier**

Learn how to build a verifier from the merchant's point of view. This guide follows the
[Multipaz Wholesale POS](https://github.com/openwallet-foundation/multipaz-samples/tree/b73a59b02aa0b4f98076da00ab2ef30c91e90b66/MultipazWholesalePOS)
reference app, which accepts a Digital Payment Credential (DPC) over ISO/IEC 18013-5 proximity
(NFC, or QR followed by BLE).

The POS is deliberately split into an app and a terminal backend. The app reads the credential but
does not hold the payment signing key. It proves that it is a genuine terminal build through device
attestation; the backend holds the key and asks the records server to settle the transaction.

```text
Holder wallet ── NFC or QR + BLE ──> POS app ── attested RPC ──> terminal backend ──> records server
                                      │                                      │
                                      └── DeviceRequest binds amount/payee ───┘
```

**What this diagram shows:** The holder shares a credential with the POS over proximity. The POS
creates a [DeviceRequest](https://developer.multipaz.org/kdocs/multipaz/org.multipaz.mdoc.request/index.html)
bound to the payment details, while the backend—not the app—holds the authority used to settle the
transaction.

Start with the runnable demo to see the complete experience, then work through the implementation
pages. Each contains a focused excerpt from the runnable POS source; use the source link below an
excerpt when you need the surrounding UI or plumbing.

- **[Run the Wholesale POS demo](./run-wholesale-pos)** — start the services and exercise the complete flow.
- **[Configure terminal trust](./import-cert)** — authenticate the terminal app and keep the payment key server-side.
- **[Create a payment request](./issuer-trust)** — reserve a transaction and bind amount, currency, and payee to the credential request.
- **[Read a credential over proximity](./read-qr)** — handle NFC/QR engagement and run the encrypted reader exchange.
- **[Settle the payment](./settle-payment)** — submit the presentment record and safely handle approval or decline.

:::warning Demo, not a production deployment
The sample uses development configuration, including local HTTP and a development attestation
policy. A production terminal needs hardened device-attestation requirements, TLS, managed payment
keys, and a governed issuer-trust configuration.
:::
