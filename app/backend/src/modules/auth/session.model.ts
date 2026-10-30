import { Schema, model } from "mongoose";

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    csrfTokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

export const Session = model("Session", sessionSchema);
