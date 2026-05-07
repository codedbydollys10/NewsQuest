import { NewsDataError } from '../services/newsDataService.js';
export const errorHandler = (err, _req, res, _next) => {
    if (err instanceof NewsDataError) {
        // For rate limiting errors, return empty success response instead of error
        if (err.statusCode === 429) {
            return res.status(200).json({
                success: true,
                articles: [],
                nextPage: null,
                totalResults: 0,
                _cached: true,
                _rateLimited: true,
            });
        }
        return res.status(err.statusCode).json({
            success: false,
            error: err.message,
            ...(process.env.NODE_ENV === 'development' ? { raw: err.raw } : {}),
        });
    }
    if (err && typeof err === 'object' && 'statusCode' in err) {
        const typedErr = err;
        // For rate limiting, return empty success instead of error
        if (typedErr.statusCode === 429) {
            return res.status(200).json({
                success: true,
                articles: [],
                nextPage: null,
                totalResults: 0,
                _cached: true,
                _rateLimited: true,
            });
        }
        return res.status(typedErr.statusCode ?? 500).json({
            success: false,
            error: typedErr.message ?? 'Request failed',
        });
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (err instanceof Error) {
        console.error('[Unhandled error]', err);
    }
    return res.status(500).json({
        success: false,
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && err instanceof Error ? { stack: err.stack } : {}),
    });
};
