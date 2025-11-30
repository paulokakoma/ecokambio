const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
    region: "us-east-1", // Contabo uses a default region, often 'us-east-1' or 'default' is fine as the endpoint handles routing
    endpoint: process.env.CONTABO_ENDPOINT, // e.g., https://eu2.contabostorage.com
    forcePathStyle: true, // Required for some S3 compatible storages
    credentials: {
        accessKeyId: process.env.CONTABO_ACCESS_KEY_ID,
        secretAccessKey: process.env.CONTABO_SECRET_ACCESS_KEY
    }
});

/**
 * Uploads a file buffer to Contabo S3.
 * @param {Buffer} fileBuffer - The file content.
 * @param {string} fileName - The destination file name (key).
 * @param {string} contentType - The MIME type of the file.
 * @returns {Promise<string>} - The public URL of the uploaded file.
 */
const uploadFileToS3 = async (fileBuffer, fileName, contentType) => {
    const bucketName = process.env.CONTABO_BUCKET_NAME;

    if (!bucketName) {
        throw new Error("CONTABO_BUCKET_NAME not defined in environment variables.");
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: 'public-read' // Ensure the file is publicly accessible
    });

    try {
        await s3Client.send(command);

        // Construct public URL
        // Format: https://<endpoint>/<bucketName>/<fileName>
        // Note: Ensure endpoint doesn't have trailing slash
        const endpoint = process.env.CONTABO_ENDPOINT.replace(/\/$/, "");
        return `${endpoint}/${bucketName}/${fileName}`;
    } catch (error) {
        console.error("Error uploading to S3:", error);
        throw error;
    }
};

module.exports = { s3Client, uploadFileToS3 };
