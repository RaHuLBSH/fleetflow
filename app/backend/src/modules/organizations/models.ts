import { Schema, model } from "mongoose";
import { userRoles } from "../auth/user.model.js";

const organizationSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  region: { type: String, trim: true, maxlength: 120 },
  timeZone: { type: String, trim: true, maxlength: 80 },
}, { timestamps: true, versionKey: false });

const membershipSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, required: true, enum: userRoles },
  isActive: { type: Boolean, required: true, default: true },
}, { timestamps: true, versionKey: false });
membershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

const invitationRoles = ["dispatcher", "driver"] as const;
const invitationSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  role: { type: String, required: true, enum: invitationRoles },
  tokenHash: { type: String, required: true, unique: true, select: false },
  invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true, index: true },
  acceptedAt: Date,
  revokedAt: Date,
}, { timestamps: true, versionKey: false });
invitationSchema.index({ organizationId: 1, email: 1, acceptedAt: 1, revokedAt: 1 });

export const Organization = model("Organization", organizationSchema);
export const OrganizationMembership = model("OrganizationMembership", membershipSchema);
export const OrganizationInvitation = model("OrganizationInvitation", invitationSchema);
export const invitedRoles = invitationRoles;
