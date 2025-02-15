/**
 * Middleware to bust the browser cache for the current user.
 * @returns {import('express').RequestHandler}
 */
export default function getCacheBusterMiddleware() {
    /**
     * @type {Set<string>} Handles that have already been busted.
     */
    const handles = new Set();

    return (request, response, next) => {
        const handle = request.user?.profile?.handle;

        if (!handle || handles.has(handle)) {
            return next();
        }

        handles.add(handle);
        response.setHeader('Clear-Site-Data', '"cache"');
        next();
    };
}
