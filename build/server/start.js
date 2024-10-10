"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const expressHbs = require("./express-handlebars/hbs");
const Path = require("path");
const http = require("http");
const sentry = __importStar(require("@sentry/node"));
const cspMiddleware_1 = require("./middleware/cspMiddleware");
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const compression_1 = __importDefault(require("compression"));
const common_1 = require("@ei/common");
const log = new common_1.Logger("mobileclient");
const revision = fs_1.default.existsSync(Path.join(process.cwd(), 'revision')) ?
    fs_1.default.readFileSync(Path.join(process.cwd(), 'revision'), 'utf-8').trim()
    : undefined;
const STATIC_ASSETS_MAX_AGE = revision && process.env.CDN_HOST ? '365d' : '0'; // 12 months
if (process.env.STATIC_ASSETS_PREFIX && process.env.CDN_HOST) {
    throw new Error('CDN_HOST and STATIC_ASSETS_PREFIX are set simultaneously. Only of of these variables can be.');
}
let STATIC_ASSETS_PREFIX = process.env.STATIC_ASSETS_PREFIX
    || (process.env.CDN_HOST ? process.env.CDN_HOST + (revision ? '/' + revision : '') : '');
// Web server and socket routing
const studioApp = express();
if (process.env.SENTRY_DSN) {
    studioApp.use(sentry.Handlers.requestHandler());
}
studioApp.use(new cspMiddleware_1.CSPMiddleware(STATIC_ASSETS_PREFIX).getMiddleware());
studioApp.disable('x-powered-by');
if (process.env.HTTPS_METHOD === "redirect") {
    studioApp.set('trust proxy', true);
    studioApp.use((req, res, next) => {
        if (req.secure) {
            next();
        }
        else {
            res.redirect('https://' + req.headers.host + req.url);
        }
    });
}
if (process.env.HTTPS_METHOD === "redirect") {
    studioApp.set('trust proxy', true);
    studioApp.use((req, res, next) => {
        if (req.secure) {
            next();
        }
        else {
            res.redirect('https://' + req.headers.host + req.url);
        }
    });
}
// set up web server options
let maxAgeObj = revision ? { maxAge: STATIC_ASSETS_MAX_AGE } : undefined;
if (!maxAgeObj && process.env.STATIC_ASSETS_MAX_AGE) {
    maxAgeObj = { maxAge: process.env.STATIC_ASSETS_MAX_AGE };
}
studioApp.use((0, compression_1.default)());
const hbs = new expressHbs.ExpressHandlebars({
    extname: '.html',
    partialsDir: [Path.join(process.cwd(), 'views', 'partials')],
});
studioApp.use(express.json());
studioApp.set('view engine', 'html');
studioApp.set('views', (Path.join(process.cwd(), 'views')));
studioApp.engine('html', hbs.engine);
studioApp.enable('view cache');
if (process.env.NODE_ENV === 'development') {
    studioApp.disable('view cache');
}
if (common_1.appConfig.mobileClient.server) {
    const corsOptions = {
        origin: [`https://smartphone.${common_1.appConfig.domain}`],
        credentials: true
    };
    studioApp.options('*', (0, cors_1.default)(corsOptions));
    studioApp.use('/v1', (0, cors_1.default)(corsOptions));
}
else {
    studioApp.use('/v1/api', (0, cors_1.default)());
}
function getBaseView(req) {
    let vm = {
        cdnPrefix: STATIC_ASSETS_PREFIX,
        layout: false,
        devMode: process.env.NODE_ENV === 'development',
        nonce: req.nonce,
        currentYear: new Date().getFullYear(),
    };
    return vm;
}
// routes
studioApp.get('/accelerometer.html', (_req, res) => {
    const req = _req;
    res.render('accelerometer.html', Object.assign({
        pageTitle: 'Accelerometer data collection - Edge Impulse',
        clientInitTag: 'data-collection-accelerometer',
    }, getBaseView(req)));
});
studioApp.get('/camera.html', (_req, res) => {
    const req = _req;
    res.render('camera.html', Object.assign({
        pageTitle: 'Camera data collection - Edge Impulse',
        clientInitTag: 'data-collection-camera',
    }, getBaseView(req)));
});
studioApp.get('/classifier.html', (_req, res) => {
    const req = _req;
    res.render('classifier.html', Object.assign({
        pageTitle: 'Mobile client - Edge Impulse',
        clientInitTag: 'classifier',
    }, getBaseView(req)));
});
studioApp.get('/', (_req, res) => {
    const req = _req;
    res.render('index.html', Object.assign({
        pageTitle: 'Mobile client - Edge Impulse',
        clientInitTag: 'data-collection',
    }, getBaseView(req)));
});
studioApp.get('/index.html', (_req, res) => {
    const req = _req;
    res.render('index.html', Object.assign({
        pageTitle: 'Mobile client - Edge Impulse',
        clientInitTag: 'data-collection',
    }, getBaseView(req)));
});
studioApp.get('/keyword.html', (_req, res) => {
    const req = _req;
    res.render('keyword.html', Object.assign({
        pageTitle: 'Keyword collector - Edge Impulse',
        clientInitTag: 'data-collection-keyword',
    }, getBaseView(req)));
});
studioApp.get('/microphone.html', (_req, res) => {
    const req = _req;
    res.render('microphone.html', Object.assign({
        pageTitle: 'Audio data collection - Edge Impulse',
        clientInitTag: 'data-collection-microphone',
    }, getBaseView(req)));
});
if (process.env.STATIC_ASSETS_PREFIX) {
    const pathPrefix = (STATIC_ASSETS_PREFIX ? '/' + STATIC_ASSETS_PREFIX.replace(/^\/+|\/+$/g, '') : '');
    studioApp.use(express.static(Path.join(process.cwd(), 'public'), undefined));
    studioApp.use(pathPrefix, express.static(Path.join(process.cwd(), 'public'), maxAgeObj));
    studioApp.use(pathPrefix + '/client', express.static(Path.join(process.cwd(), 'build', 'client'), maxAgeObj));
    studioApp.use(pathPrefix + '/client', express.static(Path.join(process.cwd(), 'client'), maxAgeObj));
}
else {
    studioApp.use(express.static(Path.join(process.cwd(), 'public'), maxAgeObj));
    studioApp.use('/client', express.static(Path.join(process.cwd(), 'build', 'client'), maxAgeObj));
    studioApp.use('/client', express.static(Path.join(process.cwd(), 'client'), maxAgeObj));
}
if (process.env.SENTRY_DSN) {
    studioApp.use(sentry.Handlers.errorHandler());
}
studioApp.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    let msg;
    if (process.env.NODE_ENV === 'development') {
        msg = (err.stack || (err.message || err.toString()));
    }
    else {
        msg = 'An error occurred when serving your request: ' + (err.message || err.toString());
    }
    res.status(500).header('Content-Type', 'text/plain').send(msg);
});
const studioServer = new http.Server(studioApp);
studioServer.listen(Number(process.env.PORT) || 4820, process.env.HOST || '0.0.0.0', async () => {
    const port = process.env.PORT || 4820;
    log.info(`Web server listening on port ${port}!`);
});
studioServer.keepAliveTimeout = 0;
studioServer.headersTimeout = 0;
studioServer.timeout = 0;
//# sourceMappingURL=start.js.map