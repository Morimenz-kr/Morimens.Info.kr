export function createRetryableInitializer(options = {}) {
    const {
        load,
        onLoading = () => {},
        onReady = () => {},
        onError = () => {}
    } = options;

    if (typeof load !== 'function') {
        throw new TypeError('Retryable initializer requires a load function.');
    }
    if ([onLoading, onReady, onError].some(callback => typeof callback !== 'function')) {
        throw new TypeError('Retryable initializer callbacks must be functions.');
    }

    let inFlight = null;

    function run(context = {}) {
        if (inFlight) return inFlight;

        const attempt = (async () => {
            try {
                await onLoading(context);
                const value = await load(context);
                await onReady(value, context);
                return Object.freeze({ ok: true, value });
            } catch (error) {
                try {
                    await onError(error, context);
                    return Object.freeze({ ok: false, error });
                } catch (reportingError) {
                    return Object.freeze({ ok: false, error, reportingError });
                }
            }
        })();

        inFlight = attempt;
        void attempt.finally(() => {
            if (inFlight === attempt) inFlight = null;
        });
        return attempt;
    }

    return Object.freeze({
        get isRunning() {
            return inFlight !== null;
        },
        run
    });
}
