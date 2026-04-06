import type { Server } from "socket.io";

declare global {
  var __roms_io: Server | undefined;
}

export {};
