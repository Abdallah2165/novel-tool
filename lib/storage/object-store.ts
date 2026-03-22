import "server-only";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type BucketLocationConstraint,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";

import { env } from "@/lib/env";

type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
};

const LOCAL_OBJECT_STORE_ROOT = path.join(process.cwd(), ".data", "object-store");

let bucketReadyPromise: Promise<void> | null = null;

function hasS3Config() {
  return Boolean(
    env.S3_ENDPOINT?.trim() &&
      env.S3_REGION?.trim() &&
      env.S3_BUCKET?.trim() &&
      env.S3_ACCESS_KEY_ID?.trim() &&
      env.S3_SECRET_ACCESS_KEY?.trim(),
  );
}

function createS3Client() {
  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
}

async function ensureBucket() {
  if (!hasS3Config()) {
    return;
  }

  if (!bucketReadyPromise) {
    bucketReadyPromise = (async () => {
      const client = createS3Client();

      try {
        await client.send(
          new HeadBucketCommand({
            Bucket: env.S3_BUCKET!,
          }),
        );
        return;
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null ? Reflect.get(error, "$metadata") : undefined;
        const httpStatusCode =
          typeof statusCode === "object" && statusCode !== null ? Reflect.get(statusCode, "httpStatusCode") : undefined;
        const name = typeof error === "object" && error !== null ? String(Reflect.get(error, "name") ?? "") : "";
        const message = error instanceof Error ? error.message : String(error ?? "");
        const shouldCreate =
          httpStatusCode === 404 ||
          name === "NotFound" ||
          name === "NoSuchBucket" ||
          message.toLowerCase().includes("not found") ||
          message.toLowerCase().includes("no such bucket");

        if (!shouldCreate) {
          throw error;
        }
      }

      const region = env.S3_REGION ?? "us-east-1";
      await client.send(
        new CreateBucketCommand({
          Bucket: env.S3_BUCKET!,
          ...(region === "us-east-1"
            ? {}
            : {
                CreateBucketConfiguration: {
                  LocationConstraint: region as BucketLocationConstraint,
                },
              }),
        }),
      );
    })().catch((error) => {
      bucketReadyPromise = null;
      throw error;
    });
  }

  await bucketReadyPromise;
}

function resolveLocalObjectPath(key: string) {
  return path.join(LOCAL_OBJECT_STORE_ROOT, ...key.split("/"));
}

export function getObjectStoreMode() {
  return hasS3Config() ? "s3" : "local";
}

export async function putObject(input: PutObjectInput) {
  if (hasS3Config()) {
    await ensureBucket();
    const client = createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET!,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
      }),
    );

    return {
      key: input.key,
      mode: "s3" as const,
    };
  }

  const filePath = resolveLocalObjectPath(input.key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.body);

  return {
    key: input.key,
    mode: "local" as const,
  };
}

export async function deleteObject(key: string) {
  if (hasS3Config()) {
    const client = createS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.S3_BUCKET!,
        Key: key,
      }),
    );
    return;
  }

  const filePath = resolveLocalObjectPath(key);
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
}

export async function readObject(key: string) {
  if (hasS3Config()) {
    const client = createS3Client();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: env.S3_BUCKET!,
        Key: key,
      }),
    );
    const bytes = await response.Body?.transformToByteArray();

    return Buffer.from(bytes ?? []);
  }

  const filePath = resolveLocalObjectPath(key);
  return readFile(filePath);
}
