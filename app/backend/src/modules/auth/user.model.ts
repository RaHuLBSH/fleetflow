import { Schema, model, type InferSchemaType } from "mongoose";

export const userRoles = ["admin", "dispatcher", "driver"] as const;
export type UserRole = (typeof userRoles)[number];

const userSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: userRoles },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, versionKey: false },
);

// An email is unique inside one tenant; the same person may belong to distinct organizations.
userSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };
export const User = model("User", userSchema);
