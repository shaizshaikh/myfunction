const { BlobServiceClient } = require('@azure/storage-blob');
const sharp = require('sharp');
const { TableClient } = require('@azure/data-tables');
const { app } = require('@azure/functions');

// Use environment variables to configure the trigger path and connection strings
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME; // Use container name from environment variable
const connectionString = process.env.AzureWebJobsStorage; // Connection string from environment variable

app.storageBlob('ProcessUserPhoto', {
    path: `${containerName}/{name}`,  // Dynamically use container name from env variable
    connection: connectionString,    // Use connection string from env variable
    handler: async (blob, context) => {
        const blobName = context.triggerMetadata.name;

        // Initialize Blob Service Client using the environment variable connection string
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(blobName);

        // Initialize Table Client using the environment variable for connection string
        const tableClient = new TableClient(
            process.env.AZURE_TABLES_CONNECTION_STRING,
            process.env.AZURE_TABLES_NAME
        );

        try {
            // Step 1: Create Thumbnail using Sharp
            const thumbnailBuffer = await sharp(blob).resize(200, 200).toBuffer();

            // Step 2: Upload Thumbnail to Same Blob Path (overwrite original)
            await blobClient.upload(thumbnailBuffer, thumbnailBuffer.length, {
                blobHTTPHeaders: { blobContentType: 'image/png' }
            });

            // Step 3: Update Table Storage with Image URL
            const sellerID = blobName.split('-')[0]; // Extract sellerID from blob name
            const rowKey = blobName.split('-')[1]; // Extract productID from blob name

            const updatedEntity = {
                partitionKey: sellerID,
                rowKey: rowKey,
                ImageUrl: blobClient.url // Store the URL of the processed blob
            };

            // Update the entity with the new ImageUrl field
            await tableClient.updateEntity(updatedEntity, 'Merge');

            context.log(`Thumbnail created and Table Storage updated for sellerID: ${sellerID}`);
        } catch (error) {
            context.log.error("Error processing the blob:", error);
        }
    }
});
