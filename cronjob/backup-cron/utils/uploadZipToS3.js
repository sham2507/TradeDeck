import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

import fs from "fs";

dotenv.config();

const keyId = process.env.KEY_ID;
const applicationKey = process.env.APPLICATION_KEY;
const bucketName = process.env.BUCKET_NAME;

if (!keyId || !applicationKey || !bucketName) {
  throw new Error("Required env not found");
}

const s3Client = new S3Client({
  region: "us-east-005",
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  credentials: {
    accessKeyId: keyId,
    secretAccessKey: applicationKey,
  },
  forcePathStyle: true,
});

const uploadFileToS3 = (zipFilePath, zipFileName) => {
  return new Promise(async (resolve, reject) => {
    try {
      const fileStream = fs.createReadStream(zipFilePath);
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: bucketName,
          Key: zipFileName,
          Body: fileStream,
          ContentType: "application/zip",
        },
        leavePartsOnError: false,
        queueSize: 1,
        partSize: 5 * 1024 * 1024,
      });

      const data = await upload.done();
      console.log("File uploaded successfully:", data);
      resolve();
    } catch (error) {
      console.error("Error uploading file to S3:", error);
      reject(error);
    }
  });
};

export default uploadFileToS3;
