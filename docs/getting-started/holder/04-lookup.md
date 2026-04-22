---
title: 🔍 Lookup and Manage Documents
sidebar_position: 4
---

Once your `DocumentStore` is initialized and populated, you can fetch, list, and manage documents within it.

### Listing and Fetching Documents

You can retrieve all documents stored in the `DocumentStore` using `DocumentStore#listDocuments`, which returns the documents directly.

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

Refer to **[this AppContainer code](https://github.com/openwallet-foundation/multipaz-samples/blob/010ae0a68cff09721fd256193139e057848abaf3/MultipazGettingStartedSample/core/src/commonMain/kotlin/org/multipaz/getstarted/core/AppContainer.kt#L31)** for the complete example.

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

Refer to **[this listDocuments code](https://github.com/openwallet-foundation/multipaz-samples/blob/010ae0a68cff09721fd256193139e057848abaf3/MultipazGettingStartedSample/core/src/commonMain/kotlin/org/multipaz/getstarted/core/AppContainerImpl.kt#L239-L247)** for the complete example.

2: **Implement the UI for listing documents in `HomeScreen` Composable**

```kotlin
@Composable
fun HomeScreen(
    // ... other parameters
    documents: List<Document>, // add document list and deletion callbacks as a parameters
    onDeleteDocument: (Document) -> Unit,
) {
    val coroutineScope = rememberCoroutineScope { AppContainer.promptModel }

    Column {
        // ...

        if (documents.isNotEmpty()) {
            Text(
                modifier = Modifier.padding(4.dp),
                text = "${documents.size} Documents present:"
            )
            documents.forEachIndexed { index, document ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = document.displayName ?: document.identifier,
                        modifier = Modifier.padding(4.dp)
                    )
                    // delete button here (explained in next step)
                }
            }
        } else {
            Text(text = "No documents found.")
        }
    }
}
```

3: **Update App.kt on `HomeScreen` invocation**

```kotlin
class App {
    private val container = AppContainer.getInstance()

    @Composable
    fun Content() {
        val documents = remember { mutableStateListOf<Document>() }

        LaunchedEffect(
            navController.currentDestination,
            provisioningState
        ) {
            val shouldRefresh = navController.currentDestination != null

            if (shouldRefresh) {
                val currentDocuments = container.listDocuments()
                if (currentDocuments.size != documents.size) {
                    documents.clear()
                    documents.addAll(currentDocuments)
                }
            }
        }

        // ...

        MaterialTheme {
            Surface {
                Column {
                    NavHost {
                        composable<Destination.HomeDestination> {
                            HomeScreen(
                                container = container,
                                navController = navController,
                                documents = documents,
                                onDeleteDocument = {
                                    documents.remove(it)
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

```

### Deleting Documents

To remove a document from the `DocumentStore`, use the `DocumentStore#deleteDocument(identifier: String)` method and provide the document's identifier.

**Example: Deleting a Document**

You can add the following code to `HomeScreen` Composable to add a small delete button to the listing we implemented above. We use a simple `IconButton` with the default delete icon. We prevent deletion of the default document to ensure the document store is never empty.

```kotlin
// delete button here (explained in next step)
if (document.displayName != CredentialDomains.SAMPLE_DOCUMENT_DISPLAY_NAME) {
    IconButton(
        content = @Composable {
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = null
            )
        },
        onClick = {
            coroutineScope.launch {
                container.documentStore.deleteDocument(document.identifier)
                onDeleteDocument(document)
            }
        }
    )
}
```

Refer to **[this code from `HomeScreen.kt`](https://github.com/openwallet-foundation/multipaz-samples/blob/010ae0a68cff09721fd256193139e057848abaf3/MultipazGettingStartedSample/composeApp/src/commonMain/kotlin/org/multipaz/getstarted/HomeScreen.kt#L110-L141)** and [**from `App.kt`**](https://github.com/openwallet-foundation/multipaz-samples/blob/010ae0a68cff09721fd256193139e057848abaf3/MultipazGettingStartedSample/composeApp/src/commonMain/kotlin/org/multipaz/getstarted/App.kt#L117-L134) for the complete example.

By following these steps, you can efficiently list, fetch, and delete documents managed by your `DocumentStore`, ensuring your application's document management remains clean and up-to-date.
