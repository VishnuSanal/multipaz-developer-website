---
title: ✅ Settle the Payment
sidebar_position: 5
---

import ThemedIframe from '../../../src/components/ThemedIframe';

After a successful proximity exchange, preserve the complete request, response, session transcript,
and reader key in an
[`Iso18013PresentmentRecord`](https://developer.multipaz.org/kdocs/multipaz/org.multipaz.verification/index.html).
Submit that record to the terminal backend; the records server is the authority that verifies it and
moves funds.

## Commit only a completed presentment

The POS converts a successful reader outcome into a presentment record. A missing response or a
non-zero status becomes an error path instead.

<ThemedIframe
  githubUrl="https://github.com/openwallet-foundation/multipaz-samples/blob/b73a59b02aa0b4f98076da00ab2ef30c91e90b66/MultipazWholesalePOS/shared/src/commonMain/kotlin/org/multipaz/pos/proximity/VerificationProximityTransferScreen.kt#L329-L364"
/>

**What this block does:** It turns a successful reader result into the self-contained record the
backend needs to verify the exact request and response together. Failed, cancelled, and incomplete
outcomes do not produce a record for settlement.

## Treat settlement as the decision point

The UI calls `commit()` only after it has a complete presentment record. It shows approval only
after the backend returns a transaction ID; transfer, cancellation, and settlement errors all become
a declined sale with a reason the cashier can act on.

<ThemedIframe
  githubUrl="https://github.com/openwallet-foundation/multipaz-samples/blob/b73a59b02aa0b4f98076da00ab2ef30c91e90b66/MultipazWholesalePOS/shared/src/commonMain/kotlin/org/multipaz/pos/App.kt#L95-L134"
/>

**What this block does:** It commits the record, creates an approved receipt state only from the
server's transaction ID, and maps cancellation, transfer, and server errors to a declined state.

Never settle based solely on claims extracted in the terminal UI. The server must verify the issuer
and device signatures, match the device-signed payment data to the reserved transaction, and ensure
the transaction has not already been committed.
