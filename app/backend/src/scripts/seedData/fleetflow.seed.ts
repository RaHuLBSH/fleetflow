
import { createHash } from "node:crypto";
import mongoose from "mongoose";

type SeedContext = {
  organizationId: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  now: Date;
};

const SEED_TAG = "fleetflow-dev-v1";

function stableId(
  organizationId: mongoose.Types.ObjectId,
  collection: string,
  key: string,
): mongoose.Types.ObjectId {
  const hex = createHash("sha256")
    .update(`${organizationId.toString()}:${collection}:${key}`)
    .digest("hex")
    .slice(0, 24);

  return new mongoose.Types.ObjectId(hex);
}

function daysFromNow(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

type Location = {
  address: string;
  coordinates: [number, number];
};

const locations: Record<string, Location> = {
  Pune: {
    address: "Hinjawadi Phase 1, Pune, Maharashtra",
    coordinates: [73.7376, 18.5913],
  },
  Mumbai: {
    address: "Andheri East, Mumbai, Maharashtra",
    coordinates: [72.8697, 19.1136],
  },
  Nashik: {
    address: "Ambad MIDC, Nashik, Maharashtra",
    coordinates: [73.7898, 19.9975],
  },
  Nagpur: {
    address: "MIHAN, Nagpur, Maharashtra",
    coordinates: [79.0472, 21.0458],
  },
  Surat: {
    address: "Udhna, Surat, Gujarat",
    coordinates: [72.8311, 21.1702],
  },
  Ahmedabad: {
    address: "SG Highway, Ahmedabad, Gujarat",
    coordinates: [72.5061, 23.0395],
  },
  Hyderabad: {
    address: "HITEC City, Hyderabad, Telangana",
    coordinates: [78.3772, 17.4435],
  },
  Bengaluru: {
    address: "Whitefield, Bengaluru, Karnataka",
    coordinates: [77.7499, 12.9698],
  },
  Indore: {
    address: "Vijay Nagar, Indore, Madhya Pradesh",
    coordinates: [75.8872, 22.7533],
  },
  Goa: {
    address: "Verna Industrial Estate, Goa",
    coordinates: [73.9219, 15.3832],
  },
};

const driverProfiles = [
  ["Aarav Patil", "+919800000101"],
  ["Rohan Deshmukh", "+919800000102"],
  ["Aditya Kulkarni", "+919800000103"],
  ["Siddharth Joshi", "+919800000104"],
  ["Kunal Shah", "+919800000105"],
  ["Omkar Jadhav", "+919800000106"],
  ["Neha Pawar", "+919800000107"],
  ["Priya Nair", "+919800000108"],
  ["Vikram Singh", "+919800000109"],
  ["Ananya Mehta", "+919800000110"],
] as const;

const vehicleProfiles = [
  ["MH12AB1001", 1200],
  ["MH12CD2002", 2500],
  ["MH14EF3003", 5000],
  ["MH12GH4004", 1000],
  ["MH15JK5005", 3500],
  ["MH31LM6006", 5000],
  ["GJ05NP7007", 2000],
  ["MH12QR8008", 1500],
  ["KA03ST9009", 4000],
  ["GA07UV1010", 1000],
] as const;

const shipmentRows = [
  {
    reference: "FF-1001",
    customerName: "Apex Electronics",
    origin: "Pune",
    destination: "Mumbai",
    status: "delivered",
    driver: 0,
    vehicle: 0,
    daysAgo: 5,
    deliveryIn: -3,
  },
  {
    reference: "FF-1002",
    customerName: "Western Auto Parts",
    origin: "Mumbai",
    destination: "Nashik",
    status: "in_transit",
    driver: 1,
    vehicle: 1,
    daysAgo: 1,
    deliveryIn: 1,
  },
  {
    reference: "FF-1003",
    customerName: "GreenLeaf Foods",
    origin: "Pune",
    destination: "Nagpur",
    status: "delayed",
    driver: 2,
    vehicle: 2,
    daysAgo: 2,
    deliveryIn: -1,
  },
  {
    reference: "FF-1004",
    customerName: "Metro Retail",
    origin: "Surat",
    destination: "Ahmedabad",
    status: "assigned",
    driver: 3,
    vehicle: 3,
    daysAgo: 0,
    deliveryIn: 2,
  },
  {
    reference: "FF-1005",
    customerName: "Nova Pharmaceuticals",
    origin: "Pune",
    destination: "Hyderabad",
    status: "dispatched",
    driver: 4,
    vehicle: 4,
    daysAgo: 1,
    deliveryIn: 1,
  },
  {
    reference: "FF-1006",
    customerName: "Urban Furniture",
    origin: "Bengaluru",
    destination: "Pune",
    status: "delayed",
    driver: 5,
    vehicle: 5,
    daysAgo: 3,
    deliveryIn: -1,
  },
  {
    reference: "FF-1007",
    customerName: "Prime Textiles",
    origin: "Indore",
    destination: "Mumbai",
    status: "in_transit",
    driver: 6,
    vehicle: 6,
    daysAgo: 1,
    deliveryIn: 1,
  },
  {
    reference: "FF-1008",
    customerName: "Coastal Supplies",
    origin: "Goa",
    destination: "Pune",
    status: "assigned",
    driver: 7,
    vehicle: 7,
    daysAgo: 0,
    deliveryIn: 2,
  },
  {
    reference: "FF-1009",
    customerName: "CityMart Distribution",
    origin: "Pune",
    destination: "Mumbai",
    status: "created",
    daysAgo: 0,
    deliveryIn: 3,
  },
  {
    reference: "FF-1010",
    customerName: "Vertex Components",
    origin: "Nagpur",
    destination: "Hyderabad",
    status: "created",
    daysAgo: 0,
    deliveryIn: 4,
  },
  {
    reference: "FF-1011",
    customerName: "Sunrise Beverages",
    origin: "Mumbai",
    destination: "Surat",
    status: "delivered",
    daysAgo: 7,
    deliveryIn: -5,
  },
  {
    reference: "FF-1012",
    customerName: "Orion Technologies",
    origin: "Pune",
    destination: "Bengaluru",
    status: "cancelled",
    daysAgo: 4,
    deliveryIn: 1,
  },
  {
    reference: "FF-1013",
    customerName: "FreshBasket",
    origin: "Nashik",
    destination: "Pune",
    status: "delivered",
    daysAgo: 3,
    deliveryIn: -1,
  },
  {
    reference: "FF-1014",
    customerName: "Rapid Industrial",
    origin: "Ahmedabad",
    destination: "Indore",
    status: "created",
    daysAgo: 0,
    deliveryIn: 5,
  },
  {
    reference: "FF-1015",
    customerName: "BlueSky Traders",
    origin: "Hyderabad",
    destination: "Nagpur",
    status: "created",
    daysAgo: 0,
    deliveryIn: 3,
  },
  {
    reference: "FF-1016",
    customerName: "Evergreen Packaging",
    origin: "Pune",
    destination: "Goa",
    status: "delivered",
    daysAgo: 6,
    deliveryIn: -4,
  },
  {
    reference: "FF-1017",
    customerName: "Aster Medical",
    origin: "Mumbai",
    destination: "Pune",
    status: "created",
    daysAgo: 0,
    deliveryIn: 2,
  },
  {
    reference: "FF-1018",
    customerName: "Summit Hardware",
    origin: "Indore",
    destination: "Ahmedabad",
    status: "created",
    daysAgo: 0,
    deliveryIn: 4,
  },
  {
    reference: "FF-1019",
    customerName: "NorthStar Logistics",
    origin: "Nagpur",
    destination: "Mumbai",
    status: "delivered",
    daysAgo: 8,
    deliveryIn: -6,
  },
  {
    reference: "FF-1020",
    customerName: "BrightHome Appliances",
    origin: "Bengaluru",
    destination: "Hyderabad",
    status: "created",
    daysAgo: 0,
    deliveryIn: 3,
  },
  {
    reference: "FF-1021",
    customerName: "Silverline Exports",
    origin: "Surat",
    destination: "Goa",
    status: "created",
    daysAgo: 0,
    deliveryIn: 5,
  },
  {
    reference: "FF-1022",
    customerName: "Pioneer Auto",
    origin: "Pune",
    destination: "Indore",
    status: "created",
    daysAgo: 0,
    deliveryIn: 2,
  },
  {
    reference: "FF-1023",
    customerName: "Greenfield Organics",
    origin: "Nashik",
    destination: "Mumbai",
    status: "created",
    daysAgo: 0,
    deliveryIn: 2,
  },
  {
    reference: "FF-1024",
    customerName: "Crestline Retail",
    origin: "Ahmedabad",
    destination: "Pune",
    status: "created",
    daysAgo: 0,
    deliveryIn: 4,
  },
  {
    reference: "FF-1025",
    customerName: "Skyline Engineering",
    origin: "Goa",
    destination: "Bengaluru",
    status: "created",
    daysAgo: 0,
    deliveryIn: 5,
  },
] as const;

type ShipmentStatus = (typeof shipmentRows)[number]["status"];

function makeEvent(
  context: SeedContext,
  shipmentId: mongoose.Types.ObjectId,
  reference: string,
  eventType: string,
  occurredAt: Date,
  sequence: number,
) {
  return {
    _id: stableId(
      context.organizationId,
      "shipment-event",
      `${reference}:${sequence}`,
    ),
    organizationId: context.organizationId,
    shipmentId,
    type: eventType,
    actorUserId: context.adminId,
    occurredAt,
    payload: {
      seedTag: SEED_TAG,
      reference,
    },
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

function getRequired<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Seed data configuration error: ${label} not found.`);
  }

  return value;
}

export function buildFleetFlowSeed(context: SeedContext) {
  const { organizationId, adminId, now } = context;

  const drivers = driverProfiles.map(([name, phone], index) => ({
    _id: stableId(organizationId, "driver", `driver-${index + 1}`),
    organizationId,
    name,
    phone,
    availability: index < 8 ? "on_delivery" : "available",
    createdAt: now,
    updatedAt: now,
  }));

  const vehicles = vehicleProfiles.map(([registrationNumber, capacityKg], index) => ({
    _id: stableId(organizationId, "vehicle", `vehicle-${index + 1}`),
    organizationId,
    registrationNumber,
    capacityKg,
    status: index < 8 ? "in_use" : "available",
    createdAt: now,
    updatedAt: now,
  }));

  const shipments: any[] = [];
  const events: any[] = [];

  for (const [index, row] of shipmentRows.entries()) {
    const createdAt = daysFromNow(now, -row.daysAgo);
    const expectedDeliveryAt = daysFromNow(now, row.deliveryIn);

    const shipmentId = stableId(
      organizationId,
      "shipment",
      row.reference,
    );

    const isAssigned = "driver" in row && "vehicle" in row;

    const assignedDriverId = isAssigned
      ? getRequired(
          drivers[row.driver],
          `Driver index ${row.driver}`,
        )._id
      : undefined;

    const assignedVehicleId = isAssigned
      ? getRequired(
          vehicles[row.vehicle],
          `Vehicle index ${row.vehicle}`,
        )._id
      : undefined;

    const status = row.status as ShipmentStatus;

    const actualDeliveryAt =
      status === "delivered"
        ? daysFromNow(now, row.deliveryIn)
        : undefined;

    const origin = getRequired(
      locations[row.origin],
      `Origin location ${row.origin}`,
    );
    
    const destination = getRequired(
      locations[row.destination],
      `Destination location ${row.destination}`,
    );

    shipments.push({
      _id: shipmentId,
      organizationId,
      reference: row.reference,
      customerName: row.customerName,
      origin: {
        address: origin.address,
        location: {
          type: "Point",
          coordinates: origin.coordinates,
        },
      },
      destination: {
        address: destination.address,
        location: {
          type: "Point",
          coordinates: destination.coordinates,
        },
      },
      status,
      pickupAt: createdAt,
      expectedDeliveryAt,
      ...(actualDeliveryAt ? { actualDeliveryAt } : {}),
      ...(assignedDriverId ? { assignedDriverId } : {}),
      ...(assignedVehicleId ? { assignedVehicleId } : {}),
      latestEtaAt: expectedDeliveryAt,
      createdBy: adminId,
      createdAt,
      updatedAt: now,
    });

    let sequence = 0;

    events.push(
      makeEvent(
        context,
        shipmentId,
        row.reference,
        "shipment_created",
        createdAt,
        sequence++,
      ),
    );

    if (isAssigned) {
      events.push(
        makeEvent(
          context,
          shipmentId,
          row.reference,
          "driver_assigned",
          daysFromNow(createdAt, 0.1),
          sequence++,
        ),
      );
    }

    if (
      ["dispatched", "in_transit", "delayed", "delivered"].includes(status)
    ) {
      events.push(
        makeEvent(
          context,
          shipmentId,
          row.reference,
          "dispatched",
          daysFromNow(createdAt, 0.2),
          sequence++,
        ),
      );
    }

    if (["in_transit", "delayed", "delivered"].includes(status)) {
      events.push(
        makeEvent(
          context,
          shipmentId,
          row.reference,
          "in_transit",
          daysFromNow(createdAt, 0.3),
          sequence++,
        ),
      );
    }

    if (status === "delayed") {
      events.push(
        makeEvent(
          context,
          shipmentId,
          row.reference,
          "delay_detected",
          daysFromNow(now, -0.1),
          sequence++,
        ),
      );
    }

    if (status === "delivered") {
      events.push(
        makeEvent(
          context,
          shipmentId,
          row.reference,
          "delivered",
          actualDeliveryAt ?? now,
          sequence++,
        ),
      );
    }

    if (status === "cancelled") {
      events.push(
        makeEvent(
          context,
          shipmentId,
          row.reference,
          "cancelled",
          daysFromNow(createdAt, 0.1),
          sequence++,
        ),
      );
    }
  }

  return { drivers, vehicles, shipments, events };
}
