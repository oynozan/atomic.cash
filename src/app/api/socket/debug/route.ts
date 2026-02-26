import { NextResponse } from "next/server";

import { getServerSocket } from "@/lib/serverSocket";

export async function POST() {
    try {
        const socket = await getServerSocket();
        socket.emit("debug:backend-test", {
            source: "next-api",
            at: Date.now(),
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown socket error";
        console.error("[api/socket/debug] error", err);
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

