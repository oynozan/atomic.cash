import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
    if (typeof window === "undefined") return null;

    if (socket) return socket;

    const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4001";

    socket = io(url, {
        transports: ["websocket"],
        withCredentials: false,
        autoConnect: true,
    });

    return socket;
}

