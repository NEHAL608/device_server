"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSPMiddleware = void 0;
const asyncMiddleware_1 = require("./asyncMiddleware");
const crypto_1 = __importDefault(require("crypto"));
const common_1 = require("@ei/common");
class CSPMiddleware {
    constructor(userCdnPrefix) {
        this._userCdnPrefix = userCdnPrefix;
    }
    getMiddleware() {
        return (0, asyncMiddleware_1.asyncMiddleware)(async (_req, res, next) => {
            let req = _req;
            req.nonce = crypto_1.default.randomBytes(16).toString('base64');
            res.set('Content-Security-Policy', CSPMiddleware.generateCSP(req, _req.path === '/classifier.html', this._userCdnPrefix));
            res.set('X-Frame-Options', 'DENY');
            res.set('X-XSS-Protection', '1; mode=block');
            res.set('Referrer-Policy', 'strict-origin');
            if (common_1.appConfig.csp) {
                res.set('Strict-Transport-Security', 'max-age=63072000');
            }
            next();
        });
    }
    static generateCSP(_req, unsafeEval = true, userCdnPrefix) {
        const studioPort = Number(process.env.STUDIO_PORT) || 4800;
        const ingestionPort = Number(process.env.INGESTION_PORT) || 4810;
        const remoteMgmtPort = Number(process.env.REMOTE_MGMT_PORT) || 4820;
        let req = _req;
        let csp = `default-src 'self' blob: edgeimpulse.com *.edgeimpulse.com; `;
        let wsProtocols = `wss: ws: wss://remote-mgmt.edgeimpulse.com`;
        if (common_1.appConfig.domain && common_1.appConfig.csp) {
            wsProtocols = `wss://studio.${common_1.appConfig.domain} wss://remote-mgmt.${common_1.appConfig.domain}`;
        }
        csp += `img-src 'self' 'unsafe-inline' edgeimpulse.com *.edgeimpulse.com www.google-analytics.com www.googletagmanager.com data: ${userCdnPrefix}; `;
        csp += "media-src 'self' edgeimpulse.com *.edgeimpulse.com blob: data: mediastream:; ";
        csp += `script-src 'self' ${unsafeEval ? "'unsafe-eval' " : ""} 'nonce-${req.nonce}' edgeimpulse.com *.edgeimpulse.com *.hsforms.net *.hsforms.com www.google-analytics.com fonts.googleapis.com youtube.com *.youtube.com browser.sentry-cdn.com js.sentry-cdn.com *.sentry.io www.googletagmanager.com d3js.org blob:; `;
        csp += `connect-src 'self' edgeimpulse.com *.edgeimpulse.com www.google-analytics.com *.hsforms.net *.hsforms.com *.amazonaws.com *.googleapis.com fonts.googleapis.com sentry.io *.sentry.io youtube.com *.youtube.com *.doubleclick.net localhost:${studioPort} localhost:${ingestionPort} localhost:${remoteMgmtPort} host.docker.internal:${studioPort} host.docker.internal:${ingestionPort} host.docker.internal:${remoteMgmtPort} data: wss://remote-mgmt.edgeimpulse.com ${wsProtocols}; `;
        csp += "style-src 'self' 'unsafe-inline' edgeimpulse.com *.edgeimpulse.com fonts.googleapis.com; ";
        csp += "base-uri 'self' edgeimpulse.com *.edgeimpulse.com; ";
        csp += "frame-ancestors 'self' edgeimpulse.com *.edgeimpulse.com mltools.arduino.cc mltools.oniudra.cc skillbuilder.optra.com skillbuilder.optraportal.com; ";
        csp += "form-action 'self'; ";
        csp += `frame-src 'self' edgeimpulse.com *.edgeimpulse.com youtube.com *.youtube.com localhost:${remoteMgmtPort}; `;
        csp += "font-src 'self' edgeimpulse.com *.edgeimpulse.com fonts.gstatic.com; ";
        csp += "report-uri https://o333795.ingest.sentry.io/api/1887001/security/?sentry_key=3ad6405147234fac8ab65061c25d2334; ";
        return csp;
    }
}
exports.CSPMiddleware = CSPMiddleware;
//# sourceMappingURL=cspMiddleware.js.map