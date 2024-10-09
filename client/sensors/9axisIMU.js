export class Positional9DOFSensor {
    constructor() {
        this._permissionGranted = false;
    }
    /**
     * This function is flawed, even if DeviceMotionEvent exists, it's not
     * guaranteed that the device has a gyroscope. The only way to know is
     * by checking the motion event itself. The problem with that is that it
     * potentially requires permissions to check, getting into a catch-22. The
     * proper way to check for gyroscope is something along these lines:
     *
     * return new Promise<boolean>(async (resolve) => {
     *     const checkForGyro = (ev: DeviceMotionEvent) => {
     *         window.removeEventListener('devicemotion', checkForGyro);
     *         const gyroIsAvailable =
     *             ev.rotationRate && (ev.rotationRate.alpha || ev.rotationRate.beta || ev.rotationRate.gamma);
     *         resolve(!!gyroIsAvailable);
     *     };
     *
     *     if (typeof DeviceMotionEvent === 'undefined') {
     *         return resolve(false);
     *     }
     *     window.addEventListener('devicemotion', checkForGyro);
     *  });
     *
     * @returns boolean
     */
    async hasSensor() {
        return typeof DeviceMotionEvent !== 'undefined' && typeof DeviceOrientationEvent !== 'undefined';
    }
    async checkPermissions(fromClick) {
        if (!(await this.hasSensor())) {
            throw new Error('9DOF not present on this device');
        }
        /* eslint-disable @typescript-eslint/no-explicit-any */
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof DeviceMotionEvent.requestPermission !== 'function') {
            return true;
        }
        if (this._permissionGranted) {
            return true;
        }
        try {
            // eslint-disable-next-line
            const response = await DeviceMotionEvent.requestPermission();
            return response === 'granted';
        }
        catch (err) {
            let msg = err instanceof Error ? err.message || err.toString() : '' + err;
            if (msg.indexOf('requires a user gesture to prompt') > -1) {
                return false;
            }
            else {
                throw err;
            }
        }
    }
    getProperties() {
        return {
            name: 'Positional',
            maxSampleLength: 5 * 60,
            frequencies: [62.5]
        };
    }
    takeSample(samplingOptions) {
        return new Promise((resolve, _reject) => {
            if (!samplingOptions.frequency) {
                throw new Error('Frequency not specified');
            }
            if (!samplingOptions.length) {
                throw new Error('Time length not specified');
            }
            let frequency = samplingOptions.frequency;
            let length = samplingOptions.length;
            let currentMotionSample = {
                x: 0,
                y: 0,
                z: 0,
                rx: 0,
                ry: 0,
                rz: 0,
                yaw: 0,
                pitch: 0,
                roll: 0
            };
            let sampleValues = [];
            let iv;
            // check if we have any data in the first second...
            const checkSensorTimeout = window.setTimeout(() => {
                if (sampleValues.length === 0) {
                    clearInterval(iv);
                    return _reject('Was not able to capture any measurements from this device. ' +
                        'This is probably a permission issue on the mobile client.');
                }
            }, 1000);
            console.log('setting interval', 1000 / frequency, 'length', length);
            iv = setInterval(() => {
                sampleValues.push([
                    currentMotionSample.x,
                    currentMotionSample.y,
                    currentMotionSample.z,
                    currentMotionSample.rx,
                    currentMotionSample.ry,
                    currentMotionSample.rz,
                    currentMotionSample.yaw,
                    currentMotionSample.pitch,
                    currentMotionSample.roll
                ]);
            }, 1000 / frequency);
            setTimeout(() => {
                clearTimeout(checkSensorTimeout);
                clearInterval(iv);
                window.removeEventListener('devicemotion', newMotionEvent);
                console.log('done', sampleValues.length, 'samples');
                resolve({
                    values: sampleValues.slice(0, Math.floor(length / (1000 / frequency))),
                    intervalMs: 1000 / frequency,
                    sensors: [
                        {
                            name: 'accX',
                            units: 'm/s2'
                        },
                        {
                            name: 'accY',
                            units: 'm/s2'
                        },
                        {
                            name: 'accZ',
                            units: 'm/s2'
                        },
                        {
                            name: 'gyroX',
                            units: 'deg/s'
                        },
                        {
                            name: 'gyroY',
                            units: 'deg/s'
                        },
                        {
                            name: 'gyroZ',
                            units: 'deg/s'
                        },
                        {
                            name: 'yaw',
                            units: 'deg'
                        },
                        {
                            name: 'pitch',
                            units: 'deg'
                        },
                        {
                            name: 'roll',
                            units: 'deg'
                        }
                    ]
                });
            }, length + 200);
            const newMotionEvent = (ev) => {
                var _a, _b, _c, _d, _e, _f;
                currentMotionSample.x = ((_a = ev.accelerationIncludingGravity) === null || _a === void 0 ? void 0 : _a.x) || 0;
                currentMotionSample.y = ((_b = ev.accelerationIncludingGravity) === null || _b === void 0 ? void 0 : _b.y) || 0;
                currentMotionSample.z = ((_c = ev.accelerationIncludingGravity) === null || _c === void 0 ? void 0 : _c.z) || 0;
                currentMotionSample.rx = ((_d = ev.rotationRate) === null || _d === void 0 ? void 0 : _d.beta) || 0;
                currentMotionSample.ry = ((_e = ev.rotationRate) === null || _e === void 0 ? void 0 : _e.gamma) || 0;
                currentMotionSample.rz = ((_f = ev.rotationRate) === null || _f === void 0 ? void 0 : _f.alpha) || 0;
            };
            const newOrientationEvent = (ev) => {
                currentMotionSample.yaw = ev.alpha || 0; // Z axis
                currentMotionSample.pitch = ev.beta || 0; // X axis
                currentMotionSample.roll = ev.gamma || 0; // Y axis
            };
            window.addEventListener('devicemotion', newMotionEvent);
            window.addEventListener('deviceorientation', newOrientationEvent);
        });
    }
}
//# sourceMappingURL=9axisIMU.js.map