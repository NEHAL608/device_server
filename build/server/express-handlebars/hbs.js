/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/*
 * Copyright (c) 2015, Yahoo Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpressHandlebars = void 0;
const glob_1 = require("glob");
const handlebars_1 = __importDefault(require("handlebars"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const utils = require('./utils');
class ExpressHandlebars {
    constructor(config) {
        this.handlebars = handlebars_1.default;
        this.compiled = {};
        this.precompiled = {};
        this._fsCache = {};
        this.extname = config.extname || '.handlebars';
        this.layoutsDir = config.layoutsDir || undefined;
        this.partialsDir = config.partialsDir || [];
        this.defaultLayout = config.defaultLayout || 'main';
        this.helpers = config.helpers || undefined;
        this.compilerOptions = config.compilerOptions || undefined;
        // Express view engine integration point.
        this.engine = this.renderView.bind(this);
        // Normalize `extname`.
        if (this.extname.charAt(0) !== '.') {
            this.extname = '.' + this.extname;
        }
        handlebars_1.default.registerHelper("when", (operand1, operator, operand2, options) => {
            let operators = {
                'eq': (l, r) => { return l === r; },
                'noteq': (l, r) => { return l !== r; },
                'gt': (l, r) => { return Number(l) > Number(r); },
                'or': (l, r) => { return l || r; },
                'and': (l, r) => { return l && r; },
                '%': (l, r) => { return (l % r) === 0; }
            };
            let result = operators[operator](operand1, operand2);
            if (result)
                return options.fn(this);
            else
                return options.inverse(this);
        });
    }
    getPartials(options) {
        let partialsDirs = Array.isArray(this.partialsDir) ?
            this.partialsDir : [this.partialsDir];
        let pd = partialsDirs.map((dir) => {
            let dirPath;
            let dirTemplates;
            let dirNamespace;
            // Support `partialsDir` collection with object entries that contain a
            // templates promise and a namespace.
            if (typeof dir === 'string') {
                dirPath = dir;
            }
            else if (typeof dir === 'object') {
                dirTemplates = dir.templates;
                dirNamespace = dir.namespace;
                dirPath = dir.dir;
            }
            // We must have some path to templates, or templates themselves.
            if (!(dirPath || dirTemplates)) {
                throw new Error('A partials dir must be a string or config object');
            }
            // Make sure we're have a promise for the templates.
            let templatesPromise = dirTemplates ? Promise.resolve(dirTemplates) :
                this.getTemplates(dirPath, options);
            return templatesPromise.then((templates) => {
                return {
                    templates: templates,
                    namespace: dirNamespace,
                };
            });
        });
        return Promise.all(pd).then((dirs) => {
            let getTemplateName = this._getTemplateName.bind(this);
            return dirs.reduce((partials, dir) => {
                let templates = dir.templates;
                let namespace = dir.namespace;
                let filePaths = Object.keys(templates);
                filePaths.forEach((filePath) => {
                    let partialName = getTemplateName(filePath, namespace);
                    partials[partialName] = templates[filePath];
                });
                return partials;
            }, {});
        });
    }
    getTemplate(filePath, options) {
        filePath = path_1.default.resolve(filePath);
        if (!options)
            options = {};
        let precompiled = options.precompiled;
        let cache = precompiled ? this.precompiled : this.compiled;
        let template = options.cache && cache[filePath];
        if (template) {
            return template;
        }
        // Optimistically cache template promise to reduce file system I/O, but
        // remove from cache if there was a problem.
        template = cache[filePath] = this._getFile(filePath, { cache: options.cache })
            .then((file) => {
            if (precompiled) {
                return this._precompileTemplate(file, this.compilerOptions);
            }
            return this._compileTemplate(file, this.compilerOptions);
        });
        return template.catch((err) => {
            delete cache[filePath];
            throw err;
        });
    }
    getTemplates(dirPath, options) {
        if (!options)
            options = {};
        let cache = options.cache;
        return this._getDir(dirPath, { cache: cache }).then((filePaths) => {
            let templates = filePaths.map((filePath) => {
                return this.getTemplate(path_1.default.join(dirPath, filePath), options);
            });
            return Promise.all(templates).then((t) => {
                return filePaths.reduce((hash, filePath, i) => {
                    hash[filePath] = t[i];
                    return hash;
                }, {});
            });
        });
    }
    render(filePath, context, options) {
        if (!options)
            options = {};
        return Promise.all([
            this.getTemplate(filePath, { cache: options.cache }),
            options.partials || this.getPartials({ cache: options.cache }),
        ]).then((templates) => {
            if (!options)
                options = {};
            let template = templates[0];
            let partials = templates[1];
            let helpers = options.helpers || this.helpers;
            // Add ExpressHandlebars metadata to the data channel so that it's
            // accessible within the templates and helpers, namespaced under:
            // `@exphbs.*`
            let data = utils.assign({}, options.data, {
                exphbs: utils.assign({}, options, {
                    filePath: filePath,
                    helpers: helpers,
                    partials: partials,
                }),
            });
            return this._renderTemplate(template, context, {
                data: data,
                helpers: helpers,
                partials: partials,
            });
        });
    }
    renderView(viewPath, options, callback) {
        if (!options)
            options = {};
        let context = options;
        // Express provides `settings.views` which is the path to the views dir that
        // the developer set on the Express app. When this value exists, it's used
        // to compute the view's name. Layouts and Partials directories are relative
        // to `settings.view` path
        let view;
        let viewsPath = options.settings && options.settings.views;
        if (viewsPath) {
            view = this._getTemplateName(path_1.default.relative(viewsPath, viewPath));
            this.partialsDir = this.partialsDir || path_1.default.join(viewsPath, 'partials/');
            this.layoutsDir = this.layoutsDir || path_1.default.join(viewsPath, 'layouts/');
        }
        // Merge render-level and instance-level helpers together.
        let helpers = utils.assign({}, this.helpers, options.helpers);
        // Merge render-level and instance-level partials together.
        let partials = Promise.all([
            this.getPartials({ cache: options.cache }),
            Promise.resolve(options.partials),
        ]).then((p) => {
            return utils.assign.apply(null, [{}].concat(p));
        });
        // Pluck-out ExpressHandlebars-specific options and Handlebars-specific
        // rendering options.
        options = {
            cache: options.cache,
            view: view,
            layout: 'layout' in options ? options.layout : this.defaultLayout,
            data: options.data,
            helpers: helpers,
            partials: partials,
        };
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.render(viewPath, context, options)
            .then((body) => {
            let layoutPath = this._resolveLayoutPath(options.layout);
            if (layoutPath) {
                return this.render(layoutPath, utils.assign({}, context, { body: body }), utils.assign({}, options, { layout: undefined }));
            }
            return body;
        })
            .then(utils.passValue(callback))
            .catch(utils.passError(callback));
    }
    // -- Protected Hooks ----------------------------------------------------------
    _compileTemplate(template, options) {
        return this.handlebars.compile(template.trim(), options);
    }
    _precompileTemplate(template, options) {
        return this.handlebars.precompile(template, options);
    }
    _renderTemplate(template, context, options) {
        return template(context, options).trim();
    }
    // -- Private ------------------------------------------------------------------
    _getDir(dirPath, options) {
        dirPath = path_1.default.resolve(dirPath);
        if (!options)
            options = {};
        let cache = this._fsCache;
        let dir = options.cache && cache[dirPath];
        if (dir) {
            return dir.then((d) => {
                return d.concat();
            }).catch((err) => {
                delete cache[dirPath];
                throw err;
            });
        }
        let pattern = '**/*' + this.extname;
        // Optimistically cache dir promise to reduce file system I/O, but remove
        // from cache if there was a problem.
        dir = cache[dirPath] = (0, glob_1.glob)(pattern, {
            cwd: dirPath,
            follow: true
        });
        return dir.then((d) => {
            return d.concat();
        }).catch((err) => {
            delete cache[dirPath];
            throw err;
        });
    }
    _getFile(filePath, options) {
        filePath = path_1.default.resolve(filePath);
        if (!options)
            options = {};
        let cache = this._fsCache;
        let file = options.cache && cache[filePath];
        if (file) {
            return file;
        }
        // Optimistically cache file promise to reduce file system I/O, but remove
        // from cache if there was a problem.
        file = cache[filePath] = new Promise((resolve, reject) => {
            fs_1.default.readFile(filePath, 'utf8', (err, f) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(f);
                }
            });
        });
        return file.catch((err) => {
            delete cache[filePath];
            throw err;
        });
    }
    _getTemplateName(filePath, namespace) {
        let extRegex = new RegExp(this.extname + '$');
        let name = filePath.replace(extRegex, '');
        if (namespace) {
            name = namespace + '/' + name;
        }
        return name;
    }
    _resolveLayoutPath(layoutPath) {
        if (!layoutPath) {
            return null;
        }
        if (!path_1.default.extname(layoutPath)) {
            layoutPath += this.extname;
        }
        return path_1.default.resolve(this.layoutsDir || '', layoutPath);
    }
}
exports.ExpressHandlebars = ExpressHandlebars;
//# sourceMappingURL=hbs.js.map