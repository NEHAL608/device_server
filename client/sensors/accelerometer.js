export class AccelerometerSensor {
    constructor() {
        this._permissionGranted = false;
    }
    async hasSensor() {
        return typeof DeviceMotionEvent !== 'undefined';
    }
    async checkPermissions(fromClick) {
        if (!(await this.hasSensor())) {
            throw new Error('Accelerometer not present on this device');
        }
        /* eslint-disable @typescript-eslint/no-explicit-any */
        if (typeof DeviceMotionEvent.requestPermission !== 'function') {
            return Promise.resolve(true);
        }
        if (this._permissionGranted) {
            return Promise.resolve(true);
        }
        // eslint-disable-next-line
        return DeviceMotionEvent
            .requestPermission()
            .then((response) => {
            return response === 'granted';
        })
            .catch((err) => {
            let msg = typeof err === 'string'
                ? err
                : err.message || err.toString();
            if (msg.indexOf('requires a user gesture to prompt') > -1) {
                return Promise.resolve(false);
            }
            else {
                throw err;
            }
        });
    }
    getProperties() {
        return {
            name: 'Accelerometer',
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
                throw new Error('Frequency not specified');
            }
            let frequency = samplingOptions.frequency;
            let length = samplingOptions.length;
            let currentSample;
            let sampleValues = [];
            let firstEvent = true;
            let iv;
            // check if we have any data in the first second...
            const checkSensorTimeout = window.setTimeout(() => {
                if (sampleValues.length === 0) {
                    clearInterval(iv);
                    return _reject('Was not able to capture any measurements from this device. ' +
                        'This is probably a permission issue on the mobile client.');
                }
            }, 1000);
            const newSensorEvent = (event) => {
                if (event.accelerationIncludingGravity) {
                    if (firstEvent) {
                        firstEvent = false;
                        console.log('setting interval', 1000 / frequency, 'length', length);
                        iv = setInterval(() => {
                            if (currentSample) {
                                sampleValues.push([
                                    currentSample.x,
                                    currentSample.y,
                                    currentSample.z
                                ]);
                            }
                        }, 1000 / frequency);
                        setTimeout(() => {
                            clearTimeout(checkSensorTimeout);
                            clearInterval(iv);
                            window.removeEventListener('devicemotion', newSensorEvent);
                            console.log('done', sampleValues.length, 'samples');
                            resolve({
                                values: sampleValues.slice(0, Math.floor(length / (1000 / frequency))),
                                intervalMs: 1000 / frequency,
                                sensors: [{
                                        name: "accX",
                                        units: "m/s2"
                                    },
                                    {
                                        name: "accY",
                                        units: "m/s2"
                                    },
                                    {
                                        name: "accZ",
                                        units: "m/s2"
                                    }
                                ],
                            });
                        }, length + 200);
                    }
                    currentSample = {
                        x: event.accelerationIncludingGravity.x || 0,
                        y: event.accelerationIncludingGravity.y || 0,
                        z: event.accelerationIncludingGravity.z || 0
                    };
                }
            };
            window.addEventListener('devicemotion', newSensorEvent);
        });
    }
}
//# sourceMappingURL=accelerometer.js.map