import type { SVGProps } from "react";

const paths: Record<string, string> = {
  overview: "M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z",
  shipments: "M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Zm0 0v9m8.5-4.5L12 12 3.5 7.5M12 12v9",
  fleet: "M3 5h18v14H3zM7 2v3m10-3v3M7 19v3m10-3v3M3 10h18",
  drivers: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 1a4 4 0 0 1 0 8m-1-17a4 4 0 0 1 0 8",
  vehicles: "M3 6h13v12H3zM16 10h3l3 3v5h-6zM7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  insights: "M9 18h6m-5 4h4m-5-8a6 6 0 1 1 6 0c-1 .8-1 2-1 2h-4s0-1.2-1-2ZM12 2v2m8 6h2M2 10h2m14.7-5.7-1.4 1.4M6.7 5.7 5.3 4.3",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 4a8 8 0 0 0-.1-1.3l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.2-1.3L15 3h-4l-.4 2.5a8 8 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.5a8 8 0 0 0 0 2.6l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.2 1.3L11 21h4l.4-2.5a8 8 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.5A8 8 0 0 0 20 12Z",
  search: "m20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0",
  arrow: "M5 12h14m-7-7 7 7-7 7",
  close: "m18 6-12 12M6 6l12 12",
  box: "M12 3 3 7.5v9l9 4.5 9-4.5v-9L12 3Zm0 0v9m9-4.5-9 4.5-9-4.5M12 12v9",
  alert: "M10.3 3.9 2 18.3A1.8 1.8 0 0 0 3.6 21h16.8a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01",
  plane: "M22 2 11 13m11-11-7 20-4-9-9-4 20-7Z",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14m-7-7h14",
  clock: "M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  collapse: "M15 18l-6-6 6-6M21 18l-6-6 6-6",
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] ?? paths.box} /></svg>;
}
