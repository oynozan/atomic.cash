import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let connecting: Promise<Socket> | null = null;

export async function getServerSocket(): Promise<Socket> {
    if (socket && socket.connected) {
        return socket;
    }

    if (connecting) {
        return connecting;
    }

    const url =
        process.env.SOCKET_SERVER_INTERNAL_URL ||
        process.env.NEXT_PUBLIC_SOCKET_URL ||
        "http://localhost:4001";

    connecting = new Promise<Socket>((resolve, reject) => {
        const s = io(url, {
            transports: ["websocket"],
        });

        const onConnect = () => {
            socket = s;
            cleanup();
            resolve(s);
        };

        const onError = (err: unknown) => {
            cleanup();
            reject(err);
        };

        const onTimeout = () => {
            cleanup();
            reject(new Error("Socket connect timeout"));
        };

        const cleanup = () => {
            s.off("connect", onConnect);
            s.off("connect_error", onError);
            clearTimeout(timeoutId);
            connecting = null;
        };

        s.on("connect", onConnect);
        s.on("connect_error", onError);

        const timeoutId = setTimeout(onTimeout, 2000);
    });

    return connecting;
}

