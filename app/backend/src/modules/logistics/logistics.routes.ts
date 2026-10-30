import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { AppError } from "../../middleware/errorHandler.js";
import { requireAuthentication, requireCsrf, requireRole } from "../auth/auth.middleware.js";
import { Driver, Shipment, ShipmentEvent, Vehicle, shipmentStatuses } from "./models.js";

const id = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid resource ID");
const address = z.object({ address: z.string().trim().min(1).max(500), location: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }).optional() });
const createShipment = z.object({ reference: z.string().trim().min(1).max(40), customerName: z.string().trim().max(120).optional(), origin: address, destination: address, scheduledPickupAt: z.string().datetime().optional(), expectedDeliveryAt: z.string().datetime().optional() });
const updateShipment = z.object({ customerName: z.string().trim().max(120).nullable().optional(), origin: address.optional(), destination: address.optional(), scheduledPickupAt: z.string().datetime().nullable().optional(), expectedDeliveryAt: z.string().datetime().nullable().optional() }).strict().refine((v) => Object.keys(v).length > 0, "At least one field is required");
const pageSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), status: z.enum(shipmentStatuses).optional(), search: z.string().trim().max(80).optional() });
const assignment = z.object({ driverId: id, vehicleId: id });
const statusBody = z.object({ status: z.enum(shipmentStatuses) });
const driverBody = z.object({ name: z.string().trim().min(1).max(120), phone: z.string().trim().max(40).optional(), userId: id.optional() });
const vehicleBody = z.object({ registrationNumber: z.string().trim().min(1).max(32), capacityKg: z.number().positive().optional() });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(400, "VALIDATION_ERROR", "The request could not be validated", result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
  return result.data;
}
const tenant = (req: Parameters<typeof requireAuthentication>[0]) => new mongoose.Types.ObjectId(req.auth!.user.organizationId);
const actor = (req: Parameters<typeof requireAuthentication>[0]) => new mongoose.Types.ObjectId(req.auth!.user.id);
const orgFilter = (req: Parameters<typeof requireAuthentication>[0]) => ({ organizationId: tenant(req) });
const serialize = (doc: any) => ({ ...doc.toObject(), id: doc._id.toString(), _id: undefined, organizationId: doc.organizationId.toString() });
async function findShipment(req: any) {
  const shipment = await Shipment.findOne({ _id: req.params.shipmentId, organizationId: tenant(req) });
  if (!shipment) throw new AppError(404, "NOT_FOUND", "Shipment not found");
  if (req.auth.user.role === "driver") {
    const driver = await Driver.findOne({ organizationId: tenant(req), userId: actor(req) });
    if (!driver || shipment.assignedDriverId?.toString() !== driver._id.toString()) throw new AppError(404, "NOT_FOUND", "Shipment not found");
  }
  return shipment;
}

export const logisticsRouter = Router();
logisticsRouter.use(requireAuthentication);

logisticsRouter.post("/shipments", requireCsrf, requireRole("admin", "dispatcher"), async (req, res, next) => {
  try {
    const input = parse(createShipment, req.body);
    const shipment = await Shipment.create({ ...input, organizationId: tenant(req), createdBy: actor(req) } as any);
    await ShipmentEvent.create({ organizationId: tenant(req), shipmentId: shipment._id, type: "shipment.created", actorUserId: actor(req) });
    res.status(201).json({ success: true, data: { shipment: serialize(shipment) } });
  } catch (error) { next(error); }
});

logisticsRouter.get("/shipments", requireRole("admin", "dispatcher", "driver"), async (req, res, next) => {
  try {
    const query = parse(pageSchema, req.query);
    const filter: Record<string, any> = { organizationId: tenant(req) };
    if (query.status) filter.status = query.status;
    if (query.search) filter.reference = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (req.auth!.user.role === "driver") {
      const driver = await Driver.findOne({ organizationId: tenant(req), userId: actor(req) });
      filter.assignedDriverId = driver?._id ?? new mongoose.Types.ObjectId();
    }
    const [items, total] = await Promise.all([Shipment.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit), Shipment.countDocuments(filter)]);
    res.json({ success: true, data: { shipments: items.map(serialize), pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } } });
  } catch (error) { next(error); }
});

logisticsRouter.get("/shipments/:shipmentId", async (req, res, next) => { try { res.json({ success: true, data: { shipment: serialize(await findShipment(req)) } }); } catch (error) { next(error); } });
logisticsRouter.patch("/shipments/:shipmentId", requireCsrf, requireRole("admin", "dispatcher"), async (req, res, next) => {
  try {
    const input = parse(updateShipment, req.body); const shipment = await Shipment.findOneAndUpdate({ _id: req.params.shipmentId, organizationId: tenant(req) }, { $set: input }, { new: true, runValidators: true });
    if (!shipment) throw new AppError(404, "NOT_FOUND", "Shipment not found");
    await ShipmentEvent.create({ organizationId: tenant(req), shipmentId: shipment._id, type: "shipment.updated", actorUserId: actor(req) });
    res.json({ success: true, data: { shipment: serialize(shipment) } });
  } catch (error) { next(error); }
});

logisticsRouter.post("/shipments/:shipmentId/assign", requireCsrf, requireRole("admin", "dispatcher"), async (req, res, next) => {
  try {
    const { driverId, vehicleId } = parse(assignment, req.body); const shipment = await Shipment.findOne({ _id: req.params.shipmentId, organizationId: tenant(req) });
    if (!shipment) throw new AppError(404, "NOT_FOUND", "Shipment not found");
    if (!["created", "assigned"].includes(shipment.status)) throw new AppError(409, "SHIPMENT_NOT_ASSIGNABLE", "Only created or assigned shipments can be assigned");
    const [driver, vehicle, driverConflict, vehicleConflict] = await Promise.all([
      Driver.findOne({ _id: driverId, organizationId: tenant(req) }), Vehicle.findOne({ _id: vehicleId, organizationId: tenant(req) }),
      Shipment.exists({ organizationId: tenant(req), assignedDriverId: driverId, status: { $in: ["assigned", "dispatched", "in_transit", "delayed"] }, _id: { $ne: shipment._id } }),
      Shipment.exists({ organizationId: tenant(req), assignedVehicleId: vehicleId, status: { $in: ["assigned", "dispatched", "in_transit", "delayed"] }, _id: { $ne: shipment._id } }),
    ]);
    if (!driver || !vehicle) throw new AppError(400, "INVALID_ASSIGNMENT", "Driver and vehicle must belong to your organization");
    if ((driver.availability !== "available" && driver._id.toString() !== shipment.assignedDriverId?.toString()) || (vehicle.status !== "available" && vehicle._id.toString() !== shipment.assignedVehicleId?.toString()) || driverConflict || vehicleConflict) throw new AppError(409, "RESOURCE_UNAVAILABLE", "The selected driver or vehicle is unavailable or already assigned");
    const previousDriverId = shipment.assignedDriverId?.toString(); const previousVehicleId = shipment.assignedVehicleId?.toString();
    shipment.assignedDriverId = driver._id; shipment.assignedVehicleId = vehicle._id; shipment.status = "assigned"; await shipment.save();
    driver.availability = "on_delivery"; vehicle.status = "in_use"; await Promise.all([driver.save(), vehicle.save()]);
    if (previousDriverId && previousDriverId !== driver._id.toString()) await Driver.updateOne({ _id: previousDriverId, organizationId: tenant(req), availability: "on_delivery" }, { availability: "available" });
    if (previousVehicleId && previousVehicleId !== vehicle._id.toString()) await Vehicle.updateOne({ _id: previousVehicleId, organizationId: tenant(req), status: "in_use" }, { status: "available" });
    await ShipmentEvent.create({ organizationId: tenant(req), shipmentId: shipment._id, type: "shipment.assigned", actorUserId: actor(req), payload: { driverId, vehicleId } });
    res.json({ success: true, data: { shipment: serialize(shipment) } });
  } catch (error) { next(error); }
});

const transitions: Record<string, string[]> = { created: ["assigned", "cancelled"], assigned: ["dispatched", "cancelled"], dispatched: ["in_transit", "cancelled"], in_transit: ["delayed", "delivered", "cancelled"], delayed: ["in_transit", "delivered", "cancelled"], delivered: [], cancelled: [] };
logisticsRouter.post("/shipments/:shipmentId/status", requireCsrf, requireRole("admin", "dispatcher", "driver"), async (req, res, next) => {
  try {
    const { status } = parse(statusBody, req.body); const shipment = await findShipment(req);
    if (!(transitions[shipment.status] ?? []).includes(status)) throw new AppError(409, "INVALID_STATUS_TRANSITION", `Cannot move a shipment from ${shipment.status} to ${status}`);
    if (req.auth!.user.role === "driver" && !["in_transit", "delayed", "delivered"].includes(status)) throw new AppError(403, "FORBIDDEN", "Drivers cannot perform this status update");
    shipment.status = status as typeof shipment.status;
    if (status === "delivered") shipment.actualDeliveryAt = new Date();
    await shipment.save();
    if (["delivered", "cancelled"].includes(status) && shipment.assignedDriverId && shipment.assignedVehicleId) {
      await Promise.all([Driver.updateOne({ _id: shipment.assignedDriverId, organizationId: tenant(req), availability: "on_delivery" }, { availability: "available" }), Vehicle.updateOne({ _id: shipment.assignedVehicleId, organizationId: tenant(req), status: "in_use" }, { status: "available" })]);
    }
    await ShipmentEvent.create({ organizationId: tenant(req), shipmentId: shipment._id, type: "shipment.status_changed", actorUserId: actor(req), payload: { status } });
    res.json({ success: true, data: { shipment: serialize(shipment) } });
  } catch (error) { next(error); }
});

logisticsRouter.get("/shipments/:shipmentId/events", async (req, res, next) => { try { const shipment = await findShipment(req); const events = await ShipmentEvent.find({ organizationId: tenant(req), shipmentId: shipment._id }).sort({ occurredAt: 1 }); res.json({ success: true, data: { events: events.map(serialize) } }); } catch (error) { next(error); } });
logisticsRouter.get("/shipments/:shipmentId/tracking", async (req, res, next) => { try { const shipment = await findShipment(req); res.json({ success: true, data: { shipmentId: shipment._id.toString(), latestEtaAt: shipment.latestEtaAt ?? null, location: null } }); } catch (error) { next(error); } });

logisticsRouter.get("/drivers", requireRole("admin", "dispatcher"), async (req, res, next) => { try { const drivers = await Driver.find(orgFilter(req)).sort({ name: 1 }); res.json({ success: true, data: { drivers: drivers.map(serialize) } }); } catch (error) { next(error); } });
logisticsRouter.get("/drivers/:driverId", requireRole("admin", "dispatcher"), async (req, res, next) => { try { const driver = await Driver.findOne({ _id: req.params.driverId, organizationId: tenant(req) }); if (!driver) throw new AppError(404, "NOT_FOUND", "Driver not found"); res.json({ success: true, data: { driver: serialize(driver) } }); } catch (error) { next(error); } });
logisticsRouter.post("/drivers", requireCsrf, requireRole("admin", "dispatcher"), async (req, res, next) => { try { const input = parse(driverBody, req.body); if (input.userId && !(await mongoose.model("User").exists({ _id: input.userId, organizationId: tenant(req), role: "driver", isActive: true }))) throw new AppError(400, "INVALID_DRIVER_USER", "Driver account must be active and in your organization"); const driver = await Driver.create({ ...input, organizationId: tenant(req) } as any); res.status(201).json({ success: true, data: { driver: serialize(driver) } }); } catch (error) { next(error); } });
logisticsRouter.patch("/drivers/:driverId", requireCsrf, requireRole("admin", "dispatcher"), async (req, res, next) => { try { const input = parse(z.object({ name: z.string().trim().min(1).max(120).optional(), phone: z.string().trim().max(40).nullable().optional(), availability: z.enum(["available", "unavailable"]).optional() }).strict().refine((v) => Object.keys(v).length > 0), req.body); const driver = await Driver.findOneAndUpdate({ _id: req.params.driverId, organizationId: tenant(req), availability: { $ne: "on_delivery" } }, { $set: input }, { new: true, runValidators: true }); if (!driver) throw new AppError(404, "NOT_FOUND", "Driver not found or currently assigned"); res.json({ success: true, data: { driver: serialize(driver) } }); } catch (error) { next(error); } });
logisticsRouter.get("/vehicles", requireRole("admin", "dispatcher"), async (req, res, next) => { try { const vehicles = await Vehicle.find(orgFilter(req)).sort({ registrationNumber: 1 }); res.json({ success: true, data: { vehicles: vehicles.map(serialize) } }); } catch (error) { next(error); } });
logisticsRouter.get("/vehicles/:vehicleId", requireRole("admin", "dispatcher"), async (req, res, next) => { try { const vehicle = await Vehicle.findOne({ _id: req.params.vehicleId, organizationId: tenant(req) }); if (!vehicle) throw new AppError(404, "NOT_FOUND", "Vehicle not found"); res.json({ success: true, data: { vehicle: serialize(vehicle) } }); } catch (error) { next(error); } });
logisticsRouter.post("/vehicles", requireCsrf, requireRole("admin", "dispatcher"), async (req, res, next) => { try { const vehicle = await Vehicle.create({ ...parse(vehicleBody, req.body), organizationId: tenant(req) } as any); res.status(201).json({ success: true, data: { vehicle: serialize(vehicle) } }); } catch (error) { next(error); } });
logisticsRouter.patch("/vehicles/:vehicleId", requireCsrf, requireRole("admin", "dispatcher"), async (req, res, next) => { try { const input = parse(z.object({ registrationNumber: z.string().trim().min(1).max(32).optional(), capacityKg: z.number().positive().nullable().optional(), status: z.enum(["available", "maintenance", "unavailable"]).optional() }).strict().refine((v) => Object.keys(v).length > 0), req.body); const vehicle = await Vehicle.findOneAndUpdate({ _id: req.params.vehicleId, organizationId: tenant(req), status: { $ne: "in_use" } }, { $set: input }, { new: true, runValidators: true }); if (!vehicle) throw new AppError(404, "NOT_FOUND", "Vehicle not found or currently assigned"); res.json({ success: true, data: { vehicle: serialize(vehicle) } }); } catch (error) { next(error); } });

