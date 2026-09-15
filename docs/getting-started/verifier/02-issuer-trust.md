---
title: 💳 Create a Payment Request
sidebar_position: 3
---

import ThemedIframe from '../../../src/components/ThemedIframe';

Before asking a holder to present a payment credential, the POS reserves a pending transaction with
the terminal backend. It then builds an ISO/IEC 18013-5
[`DeviceRequest`](https://developer.multipaz.org/kdocs/multipaz/org.multipaz.mdoc.request/index.html)
that asks for only the claims needed for the receipt and includes `transaction_data` containing the
exact payment details.

The holder device signs this transaction data as part of the response. That binds the customer's
authorization to the transaction ID, amount, currency, and payee—not merely to a generic request.

## Reserve and bind the transaction

<ThemedIframe
  githubUrl="https://github.com/openwallet-foundation/multipaz-samples/blob/b73a59b02aa0b4f98076da00ab2ef30c91e90b66/MultipazWholesalePOS/shared/src/commonMain/kotlin/org/multipaz/pos/proximity/VerificationProximityTransferScreen.kt#L278-L325"
/>

**What this block does:** It reserves a server-side transaction, serializes its amount and payee as
payment transaction data, and attaches that data to the requested DPC. The session transcript
binds this request to the active proximity exchange.

Adapt these values for your merchant:

- `CARD_DOCTYPE` and namespace — the credential type your terminal accepts.
- Requested claims — request the minimum data required for the payment and receipt.
- `TERMINAL_PAYEE_NAME`, `TERMINAL_PAYEE_ID`, and currency — values the holder should see and authorize.
- `payeeAccount` — the account that the authoritative payment service credits.

Do not treat the returned data as sufficient proof by itself. The records server must verify issuer
trust, the device signature, and that the signed transaction matches the reservation before it
settles the payment.
