---
title: 🔍 Lookup and Manage Documents
sidebar_position: 4
---

Once your `DocumentStore` is initialized and populated, you can fetch, list, and manage documents within it.

### Listing and Fetching Documents

The simplest way to render the documents in the store is to use the **`DocumentCarousel`** composable from `multipaz-compose`. It is backed by a **`DocumentModel`**, which observes the `DocumentStore` reactively — once you create the model from your store and document type repository, the carousel updates automatically as documents are added or removed (e.g. after a successful provisioning flow), so you don't need to manually re-fetch and diff a list yourself.

If you do need direct access to the documents (for non-UI logic), `DocumentStore#listDocuments` still returns them.

**Example: Listing Documents**

1: **Define the `listDocuments` function**

The `listDocuments` function is part of the `AppContainer` interface and implemented in `AppContainerImpl` (in the `core` module):

```kotlin
// core/src/commonMain/kotlin/.../core/AppContainer.kt
interface AppContainer {
    
    suspend fun listDocuments(): MutableList<Document>

    // ... rest of the implementations
}
```

Refer to **[this AppContainer code](https://github.com/openwallet-foundation/multipaz-samples/blob/7ca3e8d064a95d88f00947137043b1d96789d27c/MultipazGettingStartedSample/core/src/commonMain/kotlin/org/multipaz/getstarted/core/AppContainer.kt#L31)** for the complete example.

```kotlin
// core/src/commonMain/kotlin/.../core/AppContainerImpl.kt
class AppContainerImpl : AppContainer {
    // ...
    override suspend fun listDocuments(): MutableList<Document> {
        val documents = mutableStateListOf<Document>()
        for (document in documentStore.listDocuments()) {
            if (!documents.contains(document)) {
                documents.add(document)
            }
        }
        return documents
    }
}
```

Refer to **[this listDocuments code](https://github.com/openwallet-foundation/multipaz-samples/blob/7ca3e8d064a95d88f00947137043b1d96789d27c/MultipazGettingStartedSample/core/src/commonMain/kotlin/org/multipaz/getstarted/core/AppContainerImpl.kt#L239-L247)** for the complete example.

2: **Render the documents in `HomeScreen` using `DocumentCarousel`**

Build a `DocumentModel` from `container.documentStore` and `container.documentTypeRepository` (the latter is wired up alongside the document store — see [Setting Up the DocumentStore](01-storage.md)) and pass it to `DocumentCarousel`. We use `produceState` so model creation runs as a suspend block tied to the composition.

```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    // ...
) {
    val coroutineScope = rememberCoroutineScope { AppContainer.promptModel }

    Column {
        // ...

        val documentModel by produceState<DocumentModel?>(null, container) {
            value = DocumentModel.create(
                documentStore = container.documentStore,
                documentTypeRepository = container.documentTypeRepository,
            )
        }

        var selectedDocumentId by remember { mutableStateOf<String?>(null) }

        documentModel?.let { model ->
            DocumentCarousel(
                documentModel = model,
                onDocumentClicked = { documentInfo: DocumentInfo ->
                    selectedDocumentId = documentInfo.document.identifier
                }
            )

            selectedDocumentId?.let { id ->
                ModalBottomSheet(
                    onDismissRequest = { selectedDocumentId = null },
                ) {
                    DocumentDetails(
                        documentModel = model,
                        documentStore = container.documentStore,
                        documentId = id,
                        onDocumentDeleted = { selectedDocumentId = null },
                    )
                }
            }
        }
    }
}
```

A few notes on the snippet:

* `DocumentCarousel` renders each document as a card art tile and exposes an `onDocumentClicked` callback receiving a `DocumentInfo` (which wraps the underlying `Document`).
* Tapping a card sets `selectedDocumentId` and surfaces a `ModalBottomSheet` that hosts the `DocumentDetails` composable defined in the next section.

Refer to **[this code from `HomeScreen.kt`](https://github.com/openwallet-foundation/multipaz-samples/blob/7ca3e8d064a95d88f00947137043b1d96789d27c/MultipazGettingStartedSample/composeApp/src/commonMain/kotlin/org/multipaz/getstarted/HomeScreen.kt#L119-L148)** for the complete example.

### Showing Document Details and Deleting

Tapping a card in the carousel opens a `ModalBottomSheet` hosting a `DocumentDetails` composable. It displays the document's card art, type, name, and provisioning status, and exposes a delete button. We prevent deletion of the default sample document so the store is never empty.

```kotlin
@Composable
private fun DocumentDetails(
    documentModel: DocumentModel,
    documentStore: DocumentStore,
    documentId: String,
    onDocumentDeleted: () -> Unit,
) {
    val coroutineScope = rememberCoroutineScope()
    val documentInfo = documentModel.documentInfos.collectAsState().value
        .find { it.document.identifier == documentId }

    if (documentInfo == null) {
        Text("No document for identifier $documentId")
        return
    }
    val document = documentInfo.document

    Column(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Image(
            modifier = Modifier.height(200.dp),
            contentScale = ContentScale.FillHeight,
            bitmap = documentInfo.cardArt,
            contentDescription = null,
        )
        Text(
            text = document.typeDisplayName ?: "(typeDisplayName not set)",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.secondary,
        )

        KeyValuePair("Provisioned", if (document.provisioned) "Yes" else "No")
        KeyValuePair("Document Type", document.typeDisplayName ?: "(typeDisplayName not set)")
        KeyValuePair("Document Name", document.displayName ?: "(displayName not set)")

        if (document.displayName != CredentialDomains.SAMPLE_DOCUMENT_DISPLAY_NAME)
            Button(
                onClick = {
                    coroutineScope.launch { documentStore.deleteDocument(documentId) }
                    onDocumentDeleted()
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Red,
                    contentColor = Color.White,
                ),
            ) {
                Text("Delete document")
            }
    }
}

@Composable
private fun KeyValuePair(key: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(text = key, fontWeight = FontWeight.Bold)
        Text(text = value)
    }
}
```

Key things to note:

* `documentModel.documentInfos` is a `StateFlow<List<DocumentInfo>>`, so `collectAsState()` keeps the bottom sheet content live — if the document is deleted from another code path, the lookup will return `null` and you fall through to the empty branch.
* `DocumentStore#deleteDocument(identifier: String)` is the underlying API for removal; on success the carousel auto-refreshes via `DocumentModel`.
* Calling `onDocumentDeleted()` clears `selectedDocumentId` in the parent so the bottom sheet dismisses.

Refer to **[this code from `HomeScreen.kt`](https://github.com/openwallet-foundation/multipaz-samples/blob/7ca3e8d064a95d88f00947137043b1d96789d27c/MultipazGettingStartedSample/composeApp/src/commonMain/kotlin/org/multipaz/getstarted/HomeScreen.kt#L211-L274)** for the complete example.

By following these steps, the document list, detail view, and deletion flow stay consistent with the underlying `DocumentStore` automatically — no manual list maintenance required.
