import "dotenv/config";
import http from "http";
import { Server } from "socket.io";

const PORT = Number(process.env.SOCKET_PORT) || 4001;
const ALLOWED_ORIGINS = process.env.SOCKET_ALLOWED_ORIGINS || ""; // comma-separated

const server = http.createServer();

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (!ALLOWED_ORIGINS) return callback(null, true);

            const allowed = ALLOWED_ORIGINS.split(",")
                .map(s => s.trim())
                .filter(Boolean);

            if (allowed.length === 0 || allowed.includes(origin)) {
                callback(null, true);
            } else {
                console.log("[socket-server] blocked origin:", origin);
                callback(new Error("Not allowed by CORS"));
            }
        },
        methods: ["GET", "POST"],
    },
});

// No auth token check for now; rely on CORS + future handshake validation if needed.

io.on("connection", socket => {
    console.log("[socket-server] client connected", {
        id: socket.id,
        address: socket.handshake.address,
    });

    socket.onAny((event, ...args) => {
        console.log("[socket-server] incoming event", {
            socketId: socket.id,
            event,
            payloadPreview: JSON.stringify(args).slice(0, 500),
        });
    });

    // Simple debug flow: when backend sends this event, broadcast it to all clients
    socket.on("debug:backend-test", payload => {
        console.log("[socket-server] debug:backend-test received, broadcasting", {
            fromSocketId: socket.id,
        });
        io.emit("debug:backend-test", {
            ...payload,
            broadcastedAt: Date.now(),
        });
    });

    socket.on("transaction", payload => {
        const type =
            payload && typeof payload === "object" && "type" in payload
                ? payload.type
                : "unknown";

        console.log("[socket-server] transaction received, broadcasting", {
            fromSocketId: socket.id,
            type,
        });

        const enriched = {
            ...payload,
            type,
            broadcastedAt: Date.now(),
        };

        // Type-specific channel, e.g. "transaction:swap_prepared"
        if (type && typeof type === "string") {
            io.emit(`transaction:${type}`, enriched);
        }
    });

    socket.on("disconnect", reason => {
        console.log("[socket-server] client disconnected", {
            id: socket.id,
            reason,
        });
    });
});

server.listen(PORT, () => {
    console.log(`[socket-server] listening on port ${PORT}`);
});

