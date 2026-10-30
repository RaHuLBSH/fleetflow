export type DemoVehiclePosition = { id: string; driver: string; position: string; x: number; y: number; state: "active" | "delayed" | "available" | "unavailable"; shipment: string; route: string; eta: string };

// This is deliberately isolated prototype telemetry. It is not connected to an API or persisted.
export const demoPositions: DemoVehiclePosition[] = [
  { id: "NS-104", driver: "Marcus Bell", position: "I-90 near Rockford, IL", x: 29, y: 34, state: "active", shipment: "SHP-1043", route: "Chicago → Detroit", eta: "19:40 UTC" },
  { id: "NS-109", driver: "Tomás Reyes", position: "I-94 near Kalamazoo, MI", x: 71, y: 31, state: "active", shipment: "SHP-1045", route: "Detroit → Toledo", eta: "21:00 UTC" },
  { id: "NS-117", driver: "Priya Nair", position: "I-65 near Merrillville, IN", x: 51, y: 53, state: "delayed", shipment: "SHP-1042", route: "Chicago → Indianapolis", eta: "16:05 UTC" },
  { id: "NS-122", driver: "Diego Alvarez", position: "I-94 near Kenosha, WI", x: 39, y: 18, state: "delayed", shipment: "SHP-1044", route: "Milwaukee → Chicago", eta: "15:25 UTC" },
  { id: "NS-126", driver: "Grace Lindqvist", position: "US-12 near Madison, WI", x: 18, y: 16, state: "active", shipment: "SHP-1047", route: "Madison → Rockford", eta: "15:50 UTC" },
  { id: "NS-131", driver: "Hannah Okafor", position: "Indianapolis Depot, IN", x: 60, y: 87, state: "available", shipment: "—", route: "Available at depot", eta: "—" },
  { id: "NS-140", driver: "Kenji Watanabe", position: "I-55 near Joliet, IL", x: 48, y: 70, state: "active", shipment: "SHP-1046", route: "Joliet → St. Louis", eta: "18:30 UTC" },
  { id: "NS-152", driver: "Unassigned", position: "Columbus Service Bay, OH", x: 94, y: 76, state: "unavailable", shipment: "—", route: "Maintenance", eta: "—" },
];

export type DemoInsight = { id: string; level: "Critical" | "High" | "Medium" | "Low"; kind: string; resource: string; age: string; summary: string; facts: string[]; prediction: string; recommendation: string; confidence: number };
// Prototype examples only. No AI service or persisted analysis currently exists.
export const demoInsights: DemoInsight[] = [
  { id: "insight-delay-1042", level: "High", kind: "Delay prediction", resource: "SHP-1042", age: "10m ago", summary: "Shipment SHP-1042 is at risk of arriving approximately 45 minutes late because the route has a traffic-related delay and the remaining delivery window is limited.", facts: ["Vehicle NS-117 average speed 18 mph over the last 6 miles of I-65 S", "Delivery window closes at 16:30 local", "Refrigerated load (temperature-sensitive)"], prediction: "Revised ETA 16:50 — about 45 min past the committed window.", recommendation: "Review an alternative route via US-41 and notify the customer if the revised ETA exceeds the delivery commitment.", confidence: 82 },
  { id: "insight-eta-1044", level: "Critical", kind: "ETA deviation", resource: "SHP-1044", age: "6m ago", summary: "Vehicle NS-122 has been stationary for 14 minutes on a critical-priority pharmacy shipment with 55 minutes remaining.", facts: ["Vehicle NS-122 stationary since 14:16", "No scheduled stop on route plan", "Driver has not checked in since pickup"], prediction: "If the stop exceeds 25 min, the delivery window will likely be missed.", recommendation: "Contact driver Diego Alvarez to confirm status before considering a backup vehicle.", confidence: 67 },
  { id: "insight-conflict-131", level: "Medium", kind: "Assignment conflict", resource: "DRV-204 / NS-131", age: "25m ago", summary: "A planned shift overlap could leave one afternoon route without a confirmed driver.", facts: ["Two planned routes overlap by 35 minutes", "One driver is currently listed as available"], prediction: "Dispatch coverage may be short during the afternoon handoff.", recommendation: "Review the two pickup windows and confirm the handoff before dispatch.", confidence: 74 },
  { id: "insight-risk-140", level: "Low", kind: "Operational risk", resource: "NS-140", age: "55m ago", summary: "Vehicle NS-140 is approaching the fleet's service interval during a high utilization week.", facts: ["Utilization estimate: 83%", "Service interval is approaching"], prediction: "Availability may tighten if maintenance is deferred.", recommendation: "Review the service schedule when the vehicle returns to depot.", confidence: 58 },
  { id: "insight-delay-109", level: "High", kind: "Delay prediction", resource: "SHP-1045", age: "1h ago", summary: "The delivery window has limited slack if the current stop extends beyond plan.", facts: ["One remaining stop before delivery", "Estimated window slack: 25 minutes"], prediction: "A long stop may result in a late arrival.", recommendation: "Confirm the next stop duration before changing the route.", confidence: 62 },
];

// Small illustrative trend series, not shipment analytics from the API.
export const demoTrend = { labels: ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"], completed: [42, 48, 31, 24, 51, 56, 49], transit: [18, 21, 12, 9, 24, 22, 26], delayed: [3, 5, 2, 1, 6, 4, 7] };
