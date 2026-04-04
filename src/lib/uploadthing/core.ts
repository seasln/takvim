import { createUploadthing, type FileRouter } from "uploadthing/server";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@/lib/auth";

const f = createUploadthing();

export const uploadRouter = {
  eventAttachment: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 4 },
    image: { maxFileSize: "8MB", maxFileCount: 8 },
    blob: { maxFileSize: "16MB", maxFileCount: 4 },
  })
    .middleware(async ({ req }) => {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session)
        throw new UploadThingError("Nicht angemeldet");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata }) => ({
      uploadedBy: metadata.userId as string,
    })),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
