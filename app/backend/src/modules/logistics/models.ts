import { Schema, model } from "mongoose";

const driverSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, maxlength: 40 },
  availability: { type: String, enum: ["available", "on_delivery", "unavailable"], default: "available", required: true },
}, { timestamps: true, versionKey: false });
driverSchema.index({ organizationId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $exists: true } } });

const vehicleSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  registrationNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
  capacityKg: { type: Number, min: 1 },
  status: { type: String, enum: ["available", "in_use", "maintenance", "unavailable"], default: "available", required: true },
}, { timestamps: true, versionKey: false });
vehicleSchema.index({ organizationId: 1, registrationNumber: 1 }, { unique: true });

const pointSchema = new Schema({ type: { type: String, enum: ["Point"], required: true }, coordinates: { type: [Number], required: true, validate: { validator: (v: number[]) => v.length === 2 && v[0] !== undefined && v[1] !== undefined && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90, message: "Coordinates must be [longitude, latitude]" } } }, { _id: false });
const addressSchema = new Schema({ address: { type: String, required: true, trim: true, maxlength: 500 }, location: pointSchema }, { _id: false });
export const shipmentStatuses = ["created", "assigned", "dispatched", "in_transit", "delayed", "delivered", "cancelled"] as const;
const shipmentSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  reference: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  customerName: { type: String, trim: true, maxlength: 120 },
  origin: { type: addressSchema, required: true }, destination: { type: addressSchema, required: true },
  status: { type: String, enum: shipmentStatuses, default: "created", required: true },
  scheduledPickupAt: Date, expectedDeliveryAt: Date, actualDeliveryAt: Date,
  assignedDriverId: { type: Schema.Types.ObjectId, ref: "Driver" }, assignedVehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
  latestEtaAt: Date, createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true, versionKey: false });
shipmentSchema.index({ organizationId: 1, reference: 1 }, { unique: true });
shipmentSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
shipmentSchema.index({ organizationId: 1, assignedDriverId: 1, status: 1 });

const eventSchema = new Schema({ organizationId: { type: Schema.Types.ObjectId, required: true, index: true }, shipmentId: { type: Schema.Types.ObjectId, required: true, index: true }, type: { type: String, required: true }, actorUserId: Schema.Types.ObjectId, occurredAt: { type: Date, required: true, default: Date.now }, payload: Schema.Types.Mixed }, { versionKey: false });
eventSchema.index({ organizationId: 1, shipmentId: 1, occurredAt: 1 });

export const Driver = model("Driver", driverSchema);
export const Vehicle = model("Vehicle", vehicleSchema);
export const Shipment = model("Shipment", shipmentSchema);
export const ShipmentEvent = model("ShipmentEvent", eventSchema);
