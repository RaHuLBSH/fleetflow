import { Schema, model, type InferSchemaType } from "mongoose";

export const userRoles = ["admin", "dispatcher", "driver"] as const;
export type UserRole = (typeof userRoles)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    isActive: { type: Boolean, required: true, default: true },
    lastOrganizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true, versionKey: false, autoIndex: false },
);

// A login identifies one global account; organization-specific roles live on memberships.
userSchema.index({ email: 1 }, { unique: true });

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };
export const User = model("User", userSchema);
