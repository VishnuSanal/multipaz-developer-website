---
title: Issuer
sidebar_position: 3
---

Learn how to implement the issuance of verifiable credentials from a server to a holder app using the Multipaz SDK in a secure and standards-compliant way, following the OpenID4VCI protocol. OpenID4VCI stands for OpenID Connect for Verifiable Credential Issuance, which defines an OAuth-protected API for the issuance of Verifiable Credentials.

What you’ll implement:

* **OpenID4VCI** credential offer handling (via app links, or custom URL schemes).
* Minimal “wallet back-end” for demo purposes to complete attestation and OAuth steps.
* A basic UI that guides users through authorization and receives issued credentials.

## **Dependencies**

Add Ktor HTTP client for network calls (core + platform engines).

Update `libs.versions.toml`:

```toml
[versions]
ktor = "2.3.13"

[libraries]
ktor-client-core = { module = "io.ktor:ktor-client-core", version.ref = "ktor" }
ktor-client-java = { module = "io.ktor:ktor-client-java", version.ref = "ktor" }
ktor-client-cio = { module = "io.ktor:ktor-client-cio", version.ref = "ktor" }
ktor-client-android = { module = "io.ktor:ktor-client-android", version.ref = "ktor" }
ktor-client-darwin = { module = "io.ktor:ktor-client-darwin", version.ref = "ktor" }
```

Update `build.gradle.kts`:

```kotlin
androidMain.dependencies {
    // ...
    implementation(libs.ktor.client.android)
}

commonMain.dependencies {
    // ...
    implementation(libs.ktor.client.core)
    // CIO for JVM/Android
    implementation(libs.ktor.client.cio)
}

iosMain.dependencies {
    // Darwin engine for iOS in iosMain
    implementation(libs.ktor.client.darwin)
}
```

## **Android: Permissions and Custom URI Schemes**

Issuance needs internet access and deep link handling for:

* Credential offers (e.g., `openid-credential-offer://`)
* Wallet redirect/callback (custom or HTTPS app link)

Update `androidMain/AndroidManifest.xml`:

```xml
<!-- Networking -->
<uses-permission android:name="android.permission.INTERNET" />

<application ...>
    <activity
        android:name=".MainActivity"
        android:enableOnBackInvokedCallback="true"
        android:exported="true"
        android:launchMode="singleInstance">

        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>

        <!-- 1) Custom URI scheme for wallet redirect (used in this sample) -->
        <!-- Example redirect: get-started-app://landing/?state=... -->
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="get-started-app" />
            <data android:host="landing" />
        </intent-filter>

        <!-- 2) Credential Offer schemes (OpenID4VCI, HAIP) -->
        <!-- Allows scanning/handling credential offer URLs -->
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="openid-credential-offer" />
            <data android:scheme="haip" />
            <data android:host="*" />
        </intent-filter>

        <!-- Alternative (recommended for production): HTTPS App Links
             Requires .well-known/assetlinks.json on your domain.
             See comments in the patch for details. -->
        <!--
        <intent-filter android:autoVerify="true">
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data
                android:host="getstarted.multipaz.org"
                android:pathPattern="/landing/.*"
                android:scheme="https" />
        </intent-filter>
        -->
    </activity>
</application>
```

### Choosing a link strategy

There are two ways to route back to your app after authorization:

* Custom URI scheme (used in this sample)
    * Example: `get-started-app://landing/?state=...`
    * **Pros:** Simple to set up for demos and codelabs; no server config needed.
    * **Cons:** Cannot be initiated by the server; when multiple apps register the same scheme, Android may present a chooser or misroute the intent. This can conflict with scenarios where Test App and Getting Started Sample App are both installed.
* HTTPS App Links (preferred for production)
    * **Pros:** Verifiable, secure, server-initiated, avoids intent-misrouting when multiple apps are installed.
    * Requirements:
        * Host an Digital Asset Links file at `https://&lt;your-domain>/.well-known/assetlinks.json` containing your Android package name and signing cert SHA-256.
        * Add an Android `VIEW` intent filter with `android:autoVerify="true"` for your HTTPS domain and path.

**Recommendation:** Use custom schemes for development, switch to HTTPS App Links for production.

## **Deep Link Handling in Activity**

Handle incoming URLs (Intents) in `MainActivity` and forward them to the app logic:

**androidMain/MainActivity.kt**
```kotlin
class MainActivity : FragmentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // ...
        setContent { /* ... */ }
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        if (intent.action == Intent.ACTION_VIEW) {
            val url = intent.dataString ?: return
            lifecycle.coroutineScope.launch {
                val app = App.getInstance()
                app.init()
                app.handleUrl(url)
            }
        }
    }
}
```

## **Initialize Issuance in App**

1. Add provisioning fields and initialize ProvisioningModel.

```kotlin
// ...
class App {
    // ...
    lateinit var provisioningModel: ProvisioningModel
    val provisioningSupport = ProvisioningSupport()

    // Channel for incoming credential offer URIs
    private val credentialOffers = Channel<String>()
    // ...
    suspend fun init() {
        if (!isInitialized) {
            // ... existing initializations
            // ... to initialize provisioningModel
            provisioningModel = ProvisioningModel(
                documentStore = documentStore,
                secureArea = org.multipaz.util.Platform.getSecureArea(),
                httpClient = io.ktor.client.HttpClient() {
                    followRedirects = false
                },
                promptModel = org.multipaz.util.Platform.promptModel,
                documentMetadataInitializer = ::initializeDocumentMetadata
            )
        }
    }
}
```

2. Add URL handling for credential offers and app links:

```kotlin
class App {
    companion object {
        private const val OID4VCI_CREDENTIAL_OFFER_URL_SCHEME = "openid-credential-offer://"
        private const val HAIP_URL_SCHEME = "haip://"
        private const val ISSUER_URL = "https://issuer.multipaz.org/"
        // ...
    }

    /** Parse URLs from Activity and route them to either provisioning or app-link flow */
    fun handleUrl(url: String) {
        if (url.startsWith(OID4VCI_CREDENTIAL_OFFER_URL_SCHEME)
            || url.startsWith(HAIP_URL_SCHEME)
        ) {
            val queryIndex = url.indexOf('?')
            if (queryIndex >= 0) {
                CoroutineScope(Dispatchers.Default).launch {
                    credentialOffers.send(url)
                }
            }
        } else if (url.startsWith(ProvisioningSupport.APP_LINK_BASE_URL)) {
            CoroutineScope(Dispatchers.Default).launch {
                provisioningSupport.processAppLinkInvocation(url)
            }
        }
    }
}
```

3. Wire the issuance loop and UI switch in `Content()` composable:

```kotlin
class App {
    @Composable
    fun Content() {
        // ...
        val blePermissionState = rememberBluetoothPermissionState()
        val coroutineScope = rememberCoroutineScope { promptModel }

        var isProvisioning by remember { mutableStateOf(false) }

        val stableProvisioningModel = remember(provisioningModel) { provisioningModel }
        val stableProvisioningSupport = remember(provisioningSupport) { provisioningSupport }

        // Listen for credential offers and launch OID4VCI flow
        LaunchedEffect(true) {
            while (true) {
                val credentialOffer = credentialOffers.receive()
                stableProvisioningModel.launchOpenID4VCIProvisioning(
                    offerUri = credentialOffer,
                    clientPreferences = ProvisioningSupport.OPENID4VCI_CLIENT_PREFERENCES,
                    backend = stableProvisioningSupport
                )
                isProvisioning = true
            }
        }

        Column(/* ... */) {
            if (isProvisioning) {
                ProvisioningTestScreen(
                    stableProvisioningModel,
                    stableProvisioningSupport,
                )
            } else {
                    // Existing presentment UI (QR / BLE)...
                    // ...

                    // Convenience button: open test issuer site
                    Button(
                        modifier = Modifier.padding(16.dp),
                        onClick = { LocalUriHandler.current.openUri(ISSUER_URL) }
                    ) {
                        Text("Issue an mDoc from the server\nhttps://issuer.multipaz.org")
                    }

                    // Show documents present in the store
                    var documents by remember { mutableStateOf<List<Document>>(emptyList()) }
                    LaunchedEffect(isInitialized.value) {
                        if (isInitialized.value) documents = listDocuments()
                    }
                    if (documents.isNotEmpty()) {
                        Text(modifier = Modifier.padding(4.dp), text = "${documents.size} Documents present:")
                        documents.forEach { doc ->
                            Text(modifier = Modifier.padding(4.dp), text = doc.metadata.displayName ?: doc.identifier)
                        }
                    } else {
                        Text("No documents found.")
                    }
                }
        }
    }

    suspend fun listDocuments(): MutableList<Document> {
        val out = mutableStateListOf<Document>()
        for (id in documentStore.listDocuments()) {
            documentStore.lookupDocument(id)?.let { if (!out.contains(it)) out.add(it) }
        }
        return out
    }
}

```

4. Initialize document metadata for new credentials:

```kotlin
// Called by ProvisioningModel to set document display attributes
private suspend fun initializeDocumentMetadata(
    metadata: AbstractDocumentMetadata,
    credentialDisplay: Display,
    issuerDisplay: Display
) {
    (metadata as DocumentMetadata).setMetadata(
        displayName = credentialDisplay.text,
        typeDisplayName = credentialDisplay.text,
        cardArt = credentialDisplay.logo
            ?: ByteString(Res.readBytes("drawable/profile.png")), // todo import png
        issuerLogo = issuerDisplay.logo,
        other = null
    )
}
```

## **Demo “wallet back-end” (OpenID4VCIBackend)**

The sample includes `ProvisioningSupport`, an in-app implementation of `OpenID4VCIBackend` to sign:

* Client assertions (for token exchange)
* Wallet attestation JWT
* Key attestation JWT

It also coordinates the app-link redirect callback using a simple state→channel map.

**Important:** This is for development and testing only. Do not embed keys in production apps. In production, implement `OpenID4VCIBackend` on your server.

Highlights:

* Implements:
    * `createJwtClientAssertion(tokenUrl: String)`
    * `createJwtWalletAttestation(keyAttestation: KeyAttestation)`
    * `createJwtKeyAttestation(keyAttestations: List&lt;KeyAttestation>, challenge: String)`
* Manages app-link OAuth callbacks using a state-channel:
    * `waitForAppLinkInvocation(state)`
    * `processAppLinkInvocation(url)`

```kotlin
class ProvisioningSupport : OpenID4VCIBackend {
    companion object {
        // Custom URI Scheme used for app redirection in this sample.
        const val APP_LINK_SERVER = "get-started-app"
        const val APP_LINK_BASE_URL = "$APP_LINK_SERVER://landing/"

        // Alternative HTTP App Links (more secure)
        // const val APP_LINK_SERVER = "https://getstarted.multipaz.org"
        // const val APP_LINK_BASE_URL = "$APP_LINK_SERVER/landing/"

        // Client identity and client preferences used during OID4VCI.
        const val CLIENT_ID = "urn:uuid:418745b8-78a3-4810-88df-7898aff3ffb4"

        val OPENID4VCI_CLIENT_PREFERENCES = OpenID4VCIClientPreferences(
            clientId = CLIENT_ID,
            redirectUrl = APP_LINK_BASE_URL,
            locales = listOf("en-US"),
            signingAlgorithms = listOf(Algorithm.ESP256, Algorithm.ESP384, Algorithm.ESP512)
        )
    }

    // Wait for wallet redirect: state is provided by the issuer during OAuth
    private val lock = Mutex()
    private val pendingLinksByState = mutableMapOf<String, SendChannel<String>>()

    suspend fun processAppLinkInvocation(url: String) {
        val state = Url(url).parameters["state"] ?: ""
        lock.withLock {
            pendingLinksByState.remove(state)?.send(url)
        }
    }

    suspend fun waitForAppLinkInvocation(state: String): String {
        val channel = Channel<String>(Channel.RENDEZVOUS)
        lock.withLock { pendingLinksByState[state] = channel }
        return channel.receive()
    }

    // Sign a JWT client assertion for token endpoint
    override suspend fun createJwtClientAssertion(tokenUrl: String): String { /* loads JWK, signs JWT */ }

    // Sign wallet attestation JWT (draft-ietf-oauth-attestation-based-client-auth)
    override suspend fun createJwtWalletAttestation(keyAttestation: KeyAttestation): String { /* signs with attestation key */ }

    // Sign key attestation JWT covering ephemeral public keys
    override suspend fun createJwtKeyAttestation(
        keyAttestations: List<KeyAttestation>,
        challenge: String
    ): String { /* signs with attestation key */ }
}
```

## **Wallet back end vs Issuer**

* Wallet back end (OpenID4VCIBackend)
    * Owned and operated by the Wallet App developer.
    * Creates signed artifacts the issuer will trust:
        * Client assertion (JWT) to authenticate to a token endpoint.
        * Wallet attestation (JWT) binding the wallet to attested keys.
        * Key attestation (JWT) for ephemeral public keys plus nonce.
    * In this sample, it is mocked in-app for development. In production, implement this on your own server.
* Issuer (e.g., `issuer.multipaz.org`)
    * Operates OpenID4VCI endpoints: Authorization, Token, Credential Issuance, etc.
    * Verifies the wallet back end’s signed artifacts and issues credentials to the wallet.
* You can refer to [this](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-attestation-based-client-auth-04) document and [this diagram](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-attestation-based-client-auth-04#section-1-2) for more info on the wallet backend

For local testing, the sample loads keys from Compose resources (do not ship these in production; move to a backend):

* JWK for local client assertion signing from `files/provisioning_local_assertion_jwk.json`
* Attestation certificate from `files/provisioning_attestation_certificate.pem`
* Attestation private key from `files/provisioning_attestation_private_key.pem`

You can download these files from [here](https://github.com/openwallet-foundation/multipaz-samples/tree/45ac45b462bb7df49080a38c183dd8f9cd3f9a7c/MultipazGettingStartedSample/composeApp/src/commonMain/composeResources/files). Place these under: `composeApp/src/commonMain/composeResources/files/`

These are cached in-memory and used to produce compact JWTs with COSE-encoded signatures.

You can copy-paste the `ProvisioningSupport` file for the complete implementation from [here](https://github.com/openwallet-foundation/multipaz-samples/blob/45ac45b462bb7df49080a38c183dd8f9cd3f9a7c/MultipazGettingStartedSample/composeApp/src/commonMain/kotlin/org/multipaz/getstarted/ProvisioningSupport.kt).

## **Provisioning UI**

`ProvisioningTestScreen` consumes `ProvisioningModel.state` and renders:

* OAuth authorization challenge: opens browser to issuer, waits for app redirect, returns the invoked redirect URL to the model
* Secret text challenge: displays a passphrase field with constraints
* Progress and error states

```kotlin
@Composable
fun ProvisioningTestScreen(
    provisioningModel: ProvisioningModel,
    provisioningSupport: ProvisioningSupport,
) {
    val state = provisioningModel.state.collectAsState(ProvisioningModel.Idle).value
    Column {
        when (state) {
            is ProvisioningModel.Authorizing -> Authorize(
                provisioningModel,
                state.authorizationChallenges,
                provisioningSupport
            )
            is ProvisioningModel.Error -> {
                Text(
                    modifier = Modifier.align(Alignment.CenterHorizontally).padding(8.dp),
                    style = MaterialTheme.typography.titleLarge,
                    text = "Error: ${state.err.message}"
                )
                Text(
                    modifier = Modifier.padding(4.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    text = "For details: adb logcat -s ProvisioningModel"
                )
            }
            else -> {
                val label = when (state) {
                    ProvisioningModel.Idle -> "Initializing..."
                    ProvisioningModel.Initial -> "Starting provisioning..."
                    ProvisioningModel.Connected -> "Connected to the back-end"
                    ProvisioningModel.ProcessingAuthorization -> "Processing authorization..."
                    ProvisioningModel.Authorized -> "Authorized"
                    ProvisioningModel.RequestingCredentials -> "Requesting credentials..."
                    ProvisioningModel.CredentialsIssued -> "Credentials issued"
                    else -> ""
                }
                Text(
                    modifier = Modifier.align(Alignment.CenterHorizontally).padding(8.dp),
                    style = MaterialTheme.typography.titleLarge,
                    text = label
                )
            }
        }
    }
}

@Composable
private fun Authorize(
    provisioningModel: ProvisioningModel,
    challenges: List<AuthorizationChallenge>,
    provisioningSupport: ProvisioningSupport
) {
    when (val challenge = challenges.first()) {
        is AuthorizationChallenge.OAuth -> EvidenceRequestWebView(challenge, provisioningModel, provisioningSupport)
        is AuthorizationChallenge.SecretText -> EvidenceRequestSecretText(challenge, provisioningModel)
    }
}

@Composable
fun EvidenceRequestWebView(
    evidenceRequest: AuthorizationChallenge.OAuth,
    provisioningModel: ProvisioningModel,
    provisioningSupport: ProvisioningSupport
) {
    // Wait for the redirect invocation (get-started-app://landing/?state=...)
    LaunchedEffect(evidenceRequest.url) {
        val invokedUrl = provisioningSupport.waitForAppLinkInvocation(evidenceRequest.state)
        provisioningModel.provideAuthorizationResponse(
            AuthorizationResponse.OAuth(evidenceRequest.id, invokedUrl)
        )
    }
    // Launch external browser
    LaunchedEffect(evidenceRequest.url) {
        LocalUriHandler.current.openUri(evidenceRequest.url)
    }
    // Simple hint text...
}
```

You can copy-paste the `ProvisioningTestScreen` file for the complete implementation from [here](https://github.com/openwallet-foundation/multipaz-samples/blob/45ac45b462bb7df49080a38c183dd8f9cd3f9a7c/MultipazGettingStartedSample/composeApp/src/commonMain/kotlin/org/multipaz/getstarted/ProvisioningTestScreen.kt).

## **How issuance works (end-to-end)**

* Scan or open a credential offer link like `openid-credential-offer://?credential_offer=...`
* `App` detects credential offers and sends them to `ProvisioningModel.launchOpenID4VCIProvisioning(...)`
* The model requests a backend:
    * Client assertion JWT
    * Wallet attestation JWT
    * Key attestation JWT
* User is redirected to the issuer’s authorization page in the browser
* Issuer redirects back to the app via `get-started-app://landing/?state=...`
* `ProvisioningSupport` wakes the waiting challenge with the invoked redirect URL
* The model requests and stores issued credentials in `DocumentStore`
* The UI lists issued documents
* A credential offer URL is received:
    * As an OpenID4VCI link: `openid-credential-offer://?...` 
* `MainActivity` receives the VIEW intent and calls `App.handleUrl(url)`
* For credential offers, `App` enqueues the URL to `credentialOffers`, which triggers:
    * `ProvisioningModel.launchOpenID4VCIProvisioning(...)` with client preferences and back-end.
* For OAuth flows, the sample launches the system browser and waits for the app-link callback to the app; the URL is passed back into ProvisioningModel via `AuthorizationResponse.OAuth(...)`.
    * This will be an HTTPS app link of the form `https://apps.multipaz.org/landing/?...`
* Once authorized, credentials are issued and stored in the DocumentStore, with `initializeDocumentMetadata(...)` setting display metadata.

## **Testing**

* Use a credential offer from [issuer.multipaz.org](https://issuer.multipaz.org) for any document
* Multipaz getting started sample app will get triggered
* The in-app provisioning screen will:
    * Launch the browser for OAuth when needed.
        * Upon selecting the appropriate user id (in our case for testing), you’ll get redirected again to the app again
    * Wait for the app-link callback and continue.
    * Display progress (Connected, Authorized, Requesting credentials, etc.).
* After issuance, your credential appears in the app’s DocumentStore and is ready for presentment.
* You can see the new doc in the list of documents in the UI on the next app 

## **Production Notes**

* Keys and secrets
    * Do not embed private keys in the client. Implement `OpenID4VCIBackend` on your server.
    * Replace `CLIENT_ID` and redirect URL with your own values.
    * Generate your own keys and attestation materials.
* Use App links
    * Host a Digital Asset Links file at `https://<your-domain>/.well-known/assetlinks.json` containing your Android package name and signing cert SHA-256.
    * Add an Android `VIEW` intent filter with `android:autoVerify="true"` for your HTTPS domain and path.
    * Example `assetlinks.json` file:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "org.multipaz.getstarted",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:...:ZZ" // replace with your app's signing cert SHA-256
      ]
    }
  }
]
```

* Get the SHA-256 fingerprint using
    * `keytool -list -v -keystore <path-to-keystore>`
* Make sure your redirect URL matches your manifest filter, e.g. `https://getstarted.multipaz.org/landing/…` consistently across:
    * Issuer configuration
    * App’s `ProvisioningSupport.APP_LINK_BASE_URL`
    * Manifest HTTPS intent filter

By following these steps, you’ve added OpenID4VCI-based credential issuance to the Multipaz Getting Started Sample, including URL handling, a minimal back-end for testing, and a simple authorization UI.
