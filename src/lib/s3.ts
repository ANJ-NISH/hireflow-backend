import {S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand}
from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

const {
    S3_ENDPOINT,
    S3_PUBLIC_ENDPOINT,
    S3_REGION,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_BUCKET,
    S3_FORCE_PATH_STYLE
}= process.env;

if(!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET){
    throw new Error("S3 storage is not fully configured — check S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET in .env");
}

const s3Client= new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION || "us-east-1",
    credentials:{
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY
    },
    forcePathStyle: S3_FORCE_PATH_STYLE === "true"
});

const presignClient= S3_PUBLIC_ENDPOINT? new S3Client({
    endpoint: S3_PUBLIC_ENDPOINT,
    region: S3_REGION || "us-east-1",
    credentials:{
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY
    },
    forcePathStyle: S3_FORCE_PATH_STYLE === "true"
}) : s3Client;

export const BUCKET= S3_BUCKET;

export async function getUploadUrl(key: string, contentType: string, expiresInSeconds= 300)
{
  const command= new PutObjectCommand({Bucket: BUCKET,Key: key, ContentType: contentType});
  return getSignedUrl(presignClient, command, {expiresIn: expiresInSeconds});
}

export async function getDownloadUrl(key: string, expiresInSeconds= 300)
{
    const command= new GetObjectCommand({Bucket: BUCKET, Key: key});
    return getSignedUrl(presignClient, command, {expiresIn: expiresInSeconds});
}

export async function headObject(key: string)
{
  const command= new HeadObjectCommand({Bucket: BUCKET, Key: key});
  return s3Client.send(command);
}

export async function deleteObject(key: string)
{
    const command= new DeleteObjectCommand({Bucket: BUCKET, Key: key});
    await s3Client.send(command);
}


