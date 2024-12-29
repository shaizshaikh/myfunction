require('dotenv').config(); // Load environment variables from .env or local.settings.json

const { BlobServiceClient } = require('@azure/storage-blob');
const sharp = require('sharp');
const { app } = require('@azure/functions');

// Load environment variables from local.settings.json
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "";  // Default to "userphotos" if not found
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";  // Correct environment variable

app.storageBlob('process-image', {
    path: `${containerName}/{name}`, // Correct blob path format: 'container/{name}'
    handler: async (blob, context) => {
        const blobName = context.triggerMetadata.name;

        // Log the blob name to confirm that the trigger was fired
        context.log(`Blob trigger fired for blob: ${blobName}`);

        // Initialize Blob Service Client
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        try {
            // Step 1: Create Thumbnail using Sharp
            const thumbnailBuffer = await sharp(blob).resize(200, 200).jpeg().toBuffer();

            // Step 2: Save Thumbnail with .jpg Extension
            const thumbnailName = blobName.replace(/\.[^/.]+$/, ".jpg"); // Replace extension with .jpg
            const blobClient = containerClient.getBlockBlobClient(thumbnailName);

            await blobClient.upload(thumbnailBuffer, thumbnailBuffer.length, {
                blobHTTPHeaders: { blobContentType: 'image/jpeg' }
            });

            // Log success message
            context.log(`Your blob uploaded successfully! Thumbnail created and saved as ${thumbnailName}`);
        } catch (error) {
            // Log any errors during the blob processing
            context.log.error('Error processing the blob:', error);
        }
    }
});
