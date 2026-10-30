declare module "cookie-parser" {
  import type { RequestHandler } from "express";
  function cookieParser(secret?: string): RequestHandler;
  export default cookieParser;
}
