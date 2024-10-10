/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/*
 * Copyright (c) 2014, Yahoo Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
'use strict';
exports.assign = Object.assign;
exports.passError = passError;
exports.passValue = passValue;
// -----------------------------------------------------------------------------
function passError(callback) {
    return (reason) => {
        setImmediate(() => {
            callback(reason);
        });
    };
}
function passValue(callback) {
    return (value) => {
        setImmediate(() => {
            callback(null, value);
        });
    };
}
//# sourceMappingURL=utils.js.map