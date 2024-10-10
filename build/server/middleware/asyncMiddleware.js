"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncMiddleware = void 0;
function asyncMiddleware(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next, undefined, '')).catch(next);
    };
}
exports.asyncMiddleware = asyncMiddleware;
//# sourceMappingURL=asyncMiddleware.js.map