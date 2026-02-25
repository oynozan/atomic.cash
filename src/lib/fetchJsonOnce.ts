const inFlight = new Map<string, Promise<unknown>>();

/**
 * Fetch JSON with simple in-flight deduplication.
 * For the same URL+options while a request is pending, callers share
 * a single underlying fetch() and Promise.
 */
export function fetchJsonOnce<T>(url: string, options?: RequestInit): Promise<T> {
    const key = url + "::" + JSON.stringify(options ?? {});
    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise: Promise<T> = (async () => {
        const res = await fetch(url, options);
        if (!res.ok) {
            let message = res.statusText || "Request failed";
            try {
                const body = (await res.json()) as { error?: string };
                if (body && typeof body.error === "string" && body.error.trim() !== "") {
                    message = body.error;
                }
            } catch {
                // ignore JSON parse errors and fall back to statusText
            }
            throw new Error(message);
        }
        return (await res.json()) as T;
    })().finally(() => {
        inFlight.delete(key);
    });

    inFlight.set(key, promise);
    return promise;
}
