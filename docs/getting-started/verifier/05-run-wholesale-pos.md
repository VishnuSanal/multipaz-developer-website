---
title: ▶️ Run the Wholesale POS Demo
sidebar_position: 2
---

The [Multipaz Wholesale POS](https://github.com/openwallet-foundation/multipaz-samples/tree/b73a59b02aa0b4f98076da00ab2ef30c91e90b66/MultipazWholesalePOS)
is the complete implementation behind this guide. It consists of an Android/Kotlin Multiplatform
terminal, a small terminal backend, and a Multipaz Utopia records-server environment.

Run this first to see what the implementation pages build toward: enter a sale amount, present a
Digital Payment Credential (DPC) over NFC or QR + BLE, and receive a settled or declined result.
The records server verifies both the credential and the holder's authorization of the exact amount.

## Prerequisites

You need:

- A running Multipaz Utopia records server with a payment-processor trust root, seeded payer and
  merchant accounts, and a trusted DPC issuer.
- A wallet with a DPC issued by that trusted issuer.
- An Android device or emulator with `adb` available.

## 1. Start Multipaz Utopia

Run the Utopia records server directly:

```bash
cd /path/to/multipaz-utopia
./gradlew run
```

**What this block does:** It starts the Utopia services, including the records server on
`http://localhost:8004`, which matches the POS backend's default configuration.

Alternatively, build and run the Docker bundle:

```bash
cd /path/to/multipaz-utopia
./gradlew :deployment:buildDockerImage
docker run --rm -p 8100:8100 multipaz-utopia/server-bundle:latest
```

**What this block does:** It starts the bundled Utopia environment behind port `8100`; its Registry
is available at `http://localhost:8100/registry/`.

## 2. Start the terminal backend

From the POS project directory, start the terminal backend. For a directly running records server:

```bash
./gradlew :terminalBackend:run
```

**What this block does:** It starts the terminal backend on its configured port and makes the
attested payment RPC endpoint available to the POS app.

For the Docker bundle, point the backend at its proxied Registry instead:

```bash
./gradlew :terminalBackend:run --args="-param records_server_url=http://localhost:8100/registry"
```

**What this block does:** It overrides the backend's records-server URL. The backend appends its
`/rpc` endpoint automatically.

## 3. Install the terminal

Install the Android terminal and route its localhost traffic to the backend:

```bash
./gradlew :androidApp:installDebug
adb reverse tcp:8110 tcp:8110
```

**What this block does:** The first command installs the debug terminal. The second maps the
device's port `8110` to the development machine, allowing the app's local backend URL to reach the
running terminal backend.

## 4. Issue a DPC and take a test payment

Issue a DPC from the Utopia Bank to a wallet backed by a seeded payer account. The Registry trusts
only its enrolled issuer root, so a DPC issued under another root will be declined at settlement.

1. Open the POS app and enter an amount.
2. Select **CHECKOUT NOW**.
3. Present the wallet's DPC through NFC, or switch to QR and scan the wallet's `mdoc:` QR code.
4. Confirm that the POS reports **SETTLED / TRANSACTION VERIFIED** and that the merchant account
   shows the transaction in the records-server UI.

With the Docker bundle, inspect the merchant account (`Utopia Wholesale POS`, account `20000001`)
at `http://localhost:8100/registry/` to confirm the funds moved.

For Utopia startup, Docker deployment, DPC issuance, configuration values, and troubleshooting, use
the [POS README](https://github.com/openwallet-foundation/multipaz-samples/blob/b73a59b02aa0b4f98076da00ab2ef30c91e90b66/MultipazWholesalePOS/README.md).

:::caution Development configuration
The committed demo configuration permits cleartext local HTTP and software-backed attestation. Do
not deploy it unchanged. Require TLS and hardware-backed attestation, move private keys out of
configuration files, and use production issuer/payment-processor trust roots.
:::
