---
title: "Tap to Ride: Introducing the Multipaz Transit Terminal"
description: "A working transit faregate built with Multipaz: one NFC tap, privacy-preserving age fares, amount-bound payments, and a terminal backend that holds the keys."
date: 2026-12-01
---

_Written by [Vishnu Sanal](https://github.com/VishnuSanal), Multipaz contributor._

A faregate is a hard place to do digital identity. The rider is walking, the queue is moving, and the phone is already in a hand that is also holding a bag. There is no time to open an app, choose an account, or wait for a screen. The gate has to answer three questions in about the time it takes to tap: _Is this a real payment instrument? What does this rider owe? And can I trust this terminal?_

The **Multipaz Transit Terminal** is an open-source sample that answers all three with one tap. It reads a rider's **Digital Payment Credential (DPC)** over ISO/IEC 18013-5 proximity, optionally reads an identity credential to apply child or senior fares, records the journey, and settles the exact fare through a terminal backend that holds the payment key — not the app.

From the rider's point of view, it is two taps. Tap the wallet at the entry gate: the faregate reads the credentials, offers a list of destinations, and quotes each fare — with the child or senior discount already applied if the wallet presented a qualifying identity credential. Pick a destination, then tap the same wallet again at exit. The wallet authorizes exactly the quoted amount, the receipt appears, and the journey settles. No app to open, no account to pick, no fare class to claim.

It runs in the [Utopia demo universe](https://utopia.multipaz.org/), a fictional state where the DMV, the bank, and the transit authority all speak digital credentials. The operator, fares, and money are invented. The code, the protocols, and the trust model are real.

<!-- truncate -->

{/* TODO: embed the transit demo video here. */}

## A journey, end to end

![Transit terminal flow](/img/transit.png#gh-light-mode-only)
![Transit terminal flow](/img/transit-dark.png#gh-dark-mode-only)

<p align="center"><a href="/img/transit.excalidraw">Source (.excalidraw)</a></p>

The wallet talks to the faregate over NFC; the faregate talks to its backend over an attested RPC channel; the backend signs settlement requests to the records server. At **check-in**, the terminal reads the rider's DPC and opens a journey. At **checkout**, the rider picks a destination, the fare is calculated, and the same credential must be presented again. The wallet signs the exact fare and payee; the backend submits that signed presentment to the records server; the records server verifies it and moves the money. The receipt — and the gate — only open after settlement succeeds.

The sample is split into three pieces:

| Piece | What it does |
|---|---|
| `shared/` | Kotlin Multiplatform Compose UI, NFC reader, journey client, payment client |
| `androidApp/` / `iosApp/` | Thin platform hosts |
| `transitBackend/` | Ktor backend that verifies app attestation, stores journeys, and signs settlement requests |

Code excerpts below are trimmed for reading; each one links to the exact file, and every link is pinned to [`multipaz-samples` commit `3efcd872`](https://github.com/openwallet-foundation/multipaz-samples/tree/3efcd8725edd9747030e24a126350b98e7c5d30d/MultipazTransitTerminal) — the revision the published Utopia demo APK was built from.

## One request, two credentials

The entry tap is doing more than reading a card. In a single ISO 18013-5 `DeviceRequest`, the terminal asks for:

1. A **DPC** — required, because this is how the rider pays.
2. **One of** an mDL, a Photo ID, or an EU Personal ID — optional, because this is how the terminal learns whether a child or senior fare applies.

Multipaz's `UseCase` and `DocumentSet` APIs let the terminal describe that choice without knowing which wallet or which identity document the rider will bring. The wallet satisfies the optional use case with whatever it holds. If it holds nothing suitable, the journey still proceeds at the standard fare.

```kotlin
buildDeviceRequest(
    sessionTranscript = sessionTranscript,
    deviceRequestInfo = DeviceRequestInfo.fromValues(
        useCases = listOf(
            // The payment credential is required.
            UseCase(
                mandatory = true,
                documentSets = listOf(DocumentSet(listOf(0)))
            ),
            // An age-bearing identity credential is optional.
            // The wallet may satisfy this with an mDL, Photo ID, or EU PID.
            UseCase(
                mandatory = false,
                documentSets = listOf(
                    DocumentSet(listOf(1)),
                    DocumentSet(listOf(2)),
                    DocumentSet(listOf(3))
                )
            )
        )
    )
) {
    addDocRequest(
        docType = DigitalPaymentCredential.CARD_DOCTYPE,
        nameSpaces = mapOf(
            DigitalPaymentCredential.CARD_NAMESPACE to listOf(
                "issuer_name",
                "holder_name",
                "masked_account_reference",
                "payment_instrument_id",
                "issue_date",
                "expiry_date"
            ).associateWith { false }
        )
    )
    // ...one addDocRequest per accepted identity document
}
```

The numbers inside `DocumentSet(...)` are indices into this request's doc requests: `0` is the DPC, and `1`–`3` are the identity documents. The `sessionTranscript` is the important second argument. It binds the request to this specific NFC session, so a response cannot be replayed at another gate or against another request.

_Excerpt from [`createCheckInRequest()` in `VerificationProximityTransferScreen.kt`](https://github.com/openwallet-foundation/multipaz-samples/blob/3efcd8725edd9747030e24a126350b98e7c5d30d/MultipazTransitTerminal/shared/src/commonMain/kotlin/org/multipaz/transit/proximity/VerificationProximityTransferScreen.kt)._

## Fares from proofs, not profiles

Transit has fare classes. A common way to implement them is to ask the rider to register, prove their age once, and then trust a back-office profile forever. A credential can do better: the rider's wallet can prove an age threshold at the gate, and the terminal can apply the fare without storing a date of birth.

The sample accepts `age_over_65`, `age_over_18`, `age_in_years`, or `birth_date`, in that order, from an issuer-signed identity credential:

| Fare class | Eligibility | Fare |
|---|---|---|
| Child | Under 18 | 33% discount |
| Standard | 18–64, or no qualifying age claim | Full fare |
| Senior | 65 or older | 50% discount |

```kotlin
private fun discountOf(presentations: List<MdocVerifiedPresentation>): AgeDiscount {
    val presentation = AGE_DOCTYPES.firstNotNullOfOrNull { type ->
        presentations.firstOrNull { it.docType == type }
    } ?: return AgeDiscount.None

    if (bool("age_over_65") == true) return AgeDiscount.SeniorCitizen
    if (bool("age_over_18") == false) return AgeDiscount.Child

    // Fall back to age_in_years or birth_date when the boolean
    // claims are not present in the credential.
    // ...
}
```

Two details matter. First, the fare class comes from claims the issuer signed — not from a value the wallet or the rider chose. There is no "senior" button on the kiosk. Second, the discount is applied before the payment request is built, so the amount the wallet authorizes is the discounted fare. The backend records the fare class at check-in and the fare at exit; neither is a value the wallet gets to supply.

_Excerpt from [`PaymentCardClaims.kt`](https://github.com/openwallet-foundation/multipaz-samples/blob/3efcd8725edd9747030e24a126350b98e7c5d30d/MultipazTransitTerminal/shared/src/commonMain/kotlin/org/multipaz/transit/payment/PaymentCardClaims.kt)._

## The wallet signs the fare

At checkout, the terminal does not simply ask for the card again and charge it. It asks its backend to create a payment transaction for the fare, attaches the amount, currency, and payee to the ISO 18013-5 request as **transaction data**, and asks the wallet to sign over it. This is the same [Strong Customer Authentication (SCA) payment transaction](https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications/blob/main/docs/technical-specifications/ts12-electronic-payments-SCA-implementation-with-wallet.md) mechanism used by the [Multipaz Wholesale POS](https://github.com/openwallet-foundation/multipaz-samples/tree/3efcd8725edd9747030e24a126350b98e7c5d30d/MultipazWholesalePOS), applied to a fare instead of a shopping basket.

```kotlin
val transactionId =
    paymentSettler.createTransaction(amountCents = amountCents).transactionId

val payload = PaymentTransaction.Payload(
    transactionId = transactionId,
    currency = Constants.TERMINAL_CURRENCY,
    amount = amountCents / 100.0,
    payee = PaymentTransaction.Payee(
        name = Constants.TERMINAL_PAYEE_NAME,
        id = Constants.TERMINAL_PAYEE_ID,
    ),
)

val transactionData = PaymentTransaction.serializeIso18013Request(payload)

return buildDeviceRequest(
    sessionTranscript = sessionTranscript,
    deviceRequestInfo = DeviceRequestInfo.fromValues(/* ... */)
) {
    addDocRequest(
        docType = DigitalPaymentCredential.CARD_DOCTYPE,
        nameSpaces = mapOf(
            DigitalPaymentCredential.CARD_NAMESPACE to listOf(
                "issuer_name",
                "holder_name",
                "masked_account_reference",
                "payment_instrument_id",
                "issue_date",
                "expiry_date"
            ).associateWith { false },
            ISO_18013_TRANSACTION_DATA_NAMESPACE to
                mapOf(PaymentTransaction.identifier to true)
        ),
        docRequestInfo = DocRequestInfo(
            transactionData = TransactionsInfo(
                data = mapOf(
                    PaymentTransaction.identifier to transactionData
                )
            )
        )
    )
}
```

The wallet receives the amount and payee as transaction data, and the holder's device signs the transaction hash as part of the response. At the records server, the signed amount and currency must match the transaction that was reserved. A terminal cannot substitute a larger fare after the rider has approved it, and the same transaction cannot be committed twice.

_Excerpt from [`createCheckoutRequest()` in `VerificationProximityTransferScreen.kt`](https://github.com/openwallet-foundation/multipaz-samples/blob/3efcd8725edd9747030e24a126350b98e7c5d30d/MultipazTransitTerminal/shared/src/commonMain/kotlin/org/multipaz/transit/proximity/VerificationProximityTransferScreen.kt)._

## The terminal doesn't hold the keys

A faregate is a piece of hardware in a public place. If someone opens it, the last thing you want them to find is a key that can move money. The Android app in this sample contains **no payment-processor signing key**.

Instead, the app authenticates to a small terminal backend using **Android Key Attestation**. The backend checks the attestation against a pinned policy: the app's package name and signing-certificate digest must match. Only then does it forward the request to the records server, signing with the payment-processor identity that lives on the backend.

```kotlin
@RpcState(endpoint = "pos", creatable = true)
@CborSerializable
class TerminalPaymentProcessor : PaymentProcessor,
    RpcAuthInspector by RpcAuthBackendDelegate {

    private suspend fun <T> withRecordsProcessor(
        block: suspend (PaymentProcessor) -> T
    ): T {
        val dispatcher = RpcAuthorizedServerClient.connect(
            // ...
            signingKey = getServerIdentity(ServerIdentity.PAYMENT_PROCESSOR),
        )
        return withContext(RpcAuthClientSession()) {
            block(PaymentProcessorStub("payment", dispatcher, RpcNotifier.SILENT))
        }
    }
}
```

Three independent checks have to pass before money moves:

| Gate | Question | Where it is enforced |
|---|---|---|
| App genuineness | Is this a real terminal build? | Backend checks Android Key Attestation against package + signing certificate |
| Terminal authority | Is this terminal allowed to settle? | Backend signs to the records server with the payment-processor key |
| Credential + amount | Is the credential trusted, and did the holder sign this fare? | Records server verifies issuer and device signatures, amount, currency, and single use |

The checked-in configuration is deliberately a development setup: software-level attestation, local HTTP, and a sample payment key ([see for yourself](https://github.com/openwallet-foundation/multipaz-samples/blob/3efcd8725edd9747030e24a126350b98e7c5d30d/MultipazTransitTerminal/transitBackend/src/main/resources/resources/default_configuration.json)). A production deployment needs hardware-backed attestation or Play Integrity, TLS, managed keys in an HSM or KMS, and governed issuer trust roots. The important part is the shape: the app proves _what it is_, and the backend holds _what it can do_.

_Excerpt from [`TerminalPaymentProcessor.kt`](https://github.com/openwallet-foundation/multipaz-samples/blob/3efcd8725edd9747030e24a126350b98e7c5d30d/MultipazTransitTerminal/transitBackend/src/main/java/org/multipaz/transit/backend/TerminalPaymentProcessor.kt)._

## A journey outlives the tap

A transit payment is not a single request. It is a journey that starts at one gate and ends at another, possibly hours later, with a phone that may lose connectivity or an app that may be restarted. This is the same account-based ticketing idea transit agencies already use: the credential identifies an account, and the back office keeps the journey state.

The backend persists the journey as a small state machine:

```text
OPEN ──▶ READY_FOR_CHECKOUT ──▶ PAYMENT_PENDING ──▶ SETTLED
```

- `OPEN` — the rider tapped in; the entry station and fare class are recorded.
- `READY_FOR_CHECKOUT` — the rider selected an exit and the fare is stored.
- `PAYMENT_PENDING` — the wallet is authorizing the payment.
- `SETTLED` — the records server accepted the presentment.

Journeys expire automatically: four hours for an open journey, seven days for a settled one. The storage key is a one-way digest of the payment instrument and the app installation, so the backend does not keep raw card identifiers:

```kotlin
private fun parseReaderKey(
    paymentInstrumentId: String,
    deviceInstanceId: String
): String = MessageDigest.getInstance("SHA-256")
    .digest("$paymentInstrumentId:$deviceInstanceId".encodeToByteArray())
    .toBase64Url()
```

That state machine also makes recovery graceful. If a rider taps in, picks an exit, and the app is killed before checkout, the next tap finds the existing `READY_FOR_CHECKOUT` journey and resumes it instead of opening a second journey. If the same rider presents a different payment credential at exit, the terminal declines the tap rather than charging the wrong instrument.

_Excerpt from [`TerminalJourneyService.kt`](https://github.com/openwallet-foundation/multipaz-samples/blob/3efcd8725edd9747030e24a126350b98e7c5d30d/MultipazTransitTerminal/transitBackend/src/main/java/org/multipaz/transit/backend/TerminalJourneyService.kt)._

## Fast by default

Faregates are latency products. A tap that takes a second feels broken; a tap that takes half a second feels normal. The sample uses **NFCv2** from ISO/IEC 18013-5 Second Edition, with an NFC-only transfer. That avoids the Bluetooth Low Energy handshake that older NFC engagement flows needed, and it keeps the entire exchange on the tap.

The reader is strict about it: it accepts only an NFCv2 handover and an NFCv2 connection method. If a wallet offers something else, the terminal rejects the tap instead of silently falling back to a slower path.

```kotlin
require(scanResult.type == MdocHandoverType.V2_HANDOVER) {
    "This terminal accepts NFCv2 handover only."
}
require(scanResult.transport.connectionMethod is MdocConnectionMethodNfcV2) {
    "This terminal accepts NFCv2 NFC-only transfer only."
}
```

The rest of the reader flow is a standard ISO 18013-5 exchange: derive the session keys from the engagement and the ephemeral reader key, send the `DeviceRequest` over the encrypted session, and hand the `DeviceResponse` to the settlement path, where the records server verifies it against the transcript and the issuer trust chain. Multipaz handles the protocol; the sample handles the faregate.

_Excerpt from [`ProximityUtils.kt`](https://github.com/openwallet-foundation/multipaz-samples/blob/3efcd8725edd9747030e24a126350b98e7c5d30d/MultipazTransitTerminal/shared/src/commonMain/kotlin/org/multipaz/transit/proximity/ProximityUtils.kt)._

## Try it yourself

The terminal is part of the [Multipaz samples repository](https://github.com/openwallet-foundation/multipaz-samples/tree/3efcd8725edd9747030e24a126350b98e7c5d30d/MultipazTransitTerminal). The [README](https://github.com/openwallet-foundation/multipaz-samples/blob/3efcd8725edd9747030e24a126350b98e7c5d30d/MultipazTransitTerminal/README.md) walks through the full local setup: the Utopia records server, the terminal backend, the Android app, and the signing configuration.

If you want the shortest path to a tap:

1. Install a wallet from [apps.multipaz.org](https://apps.multipaz.org/) and get a payment credential from the Bank of Utopia.
2. Install the **Utopia Transit Terminal** APK from [utopia.multipaz.org/apps](https://utopia.multipaz.org/apps/).
3. Tap in, pick a destination, and tap the same wallet again at checkout.
4. Optionally, add an mDL or Photo ID to the wallet and see the terminal apply the fare class from its age claims, if it carries a qualifying one.

The demo path is Android because that is where the NFC tap flow is tested end to end. The UI and most of the logic live in `shared/`, and the repository includes an iOS host app for the Compose UI. As with any sample, treat the checked-in keys and attestation policy as development-only.

## What's next

This sample is a starting point, not a fare system. The pieces that a real agency would add are the interesting next conversations: fare capping and passes, student and accessibility entitlements, offline or degraded-mode validation, EMV and closed-loop media alongside digital credentials, accessibility on the kiosk, and a production attestation and key-management story.

If you build something with it, we would love to hear about it. Join the [OpenWallet Foundation Discord](https://discord.gg/openwalletfoundation), open an issue or a pull request in the samples repository, or bring it to the OWF Wallet Interop SIG. The code is open source, the demo is live, and the gate is waiting.

---

_The Multipaz Transit Terminal is a development sample built on the [Multipaz SDK](https://github.com/openwallet-foundation/multipaz). It uses a fictional operator and test credentials; it is not a production fare-collection system._
