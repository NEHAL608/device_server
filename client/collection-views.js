import { getAuth, getDeviceId, storeApiKeyAndImpulseId, storeDeviceId } from "./settings";
import { RemoteManagementConnection } from "./remote-mgmt";
import { AccelerometerSensor } from "./sensors/accelerometer";
import { MicrophoneSensor } from "./sensors/microphone";
import { CameraSensor } from "./sensors/camera";
import { Positional9DOFSensor } from "./sensors/9axisIMU";
export class DataCollectionClientViews {
    constructor() {
        this._views = {
            loading: document.querySelector('#loading-view'),
            qrcode: document.querySelector('#qrcode-view'),
            connected: document.querySelector('#remote-mgmt-connected'),
            connectionFailed: document.querySelector('#remote-mgmt-failed'),
            sampling: document.querySelector('#sampling-in-progress'),
            permission: document.querySelector('#permission-view'),
            capture: document.querySelector('#capture-camera')
        };
        this._elements = {
            deviceId: document.querySelector('#connected-device-id'),
            connectionFailedMessage: document.querySelector('#connection-failed-message'),
            samplingTimeLeft: document.querySelector('#sampling-time-left'),
            samplingRecordingStatus: document.querySelector('#sampling-recording-data-message'),
            samplingRecordingSensor: document.querySelector('#sampling-recording-sensor'),
            grantPermissionsBtn: document.querySelector('#grant-permissions-button'),
            loadingText: document.querySelector('#loading-view-text'),
        };
        this._sensors = [];
    }
    async init() {
        storeDeviceId(getDeviceId());
        const accelerometer = new AccelerometerSensor();
        if (await accelerometer.hasSensor()) {
            console.log('has accelerometer');
            this._sensors.push(accelerometer);
        }
        const microphone = new MicrophoneSensor();
        if (await microphone.hasSensor()) {
            console.log('has microphone');
            this._sensors.push(microphone);
        }
        const camera = new CameraSensor();
        if (await camera.hasSensor()) {
            console.log('has camera');
            this._sensors.push(camera);
        }
        const imu9DOF = new Positional9DOFSensor();
        if (await imu9DOF.hasSensor()) {
            console.log('has 9-axis positional sensors');
            this._sensors.push(imu9DOF);
        }
        const auth = getAuth();
        // requires api key for data collection
        if ((auth === null || auth === void 0 ? void 0 : auth.auth) === 'apiKey') {
            this.switchView(this._views.loading);
            this._elements.loadingText.textContent = 'Connecting to Edge Impulse...';
            const connection = new RemoteManagementConnection({
                apiKey: auth.apiKey,
                device: {
                    deviceId: getDeviceId(),
                    sensors: this._sensors.map(s => {
                        let p = s.getProperties();
                        return {
                            name: p.name,
                            frequencies: p.frequencies,
                            maxSampleLength: p.maxSampleLength
                        };
                    }),
                    deviceType: 'MOBILE_CLIENT'
                }
            }, this.beforeSampling.bind(this));
            connection.on('connected', () => {
                // persist keys now...
                storeApiKeyAndImpulseId(auth.apiKey, auth.impulseId);
                window.history.replaceState(null, '', window.location.pathname);
                this._elements.deviceId.textContent = getDeviceId();
                this.switchView(this._views.connected);
            });
            connection.on('error', err => {
                console.error('Connection failed', err);
                this._elements.connectionFailedMessage.textContent = err;
                this.switchView(this._views.connectionFailed);
            });
            let samplingInterval;
            connection.on('samplingStarted', length => {
                let remaining = length;
                this._elements.samplingRecordingStatus.textContent = 'Recording data';
                this._elements.samplingTimeLeft.textContent = Math.floor(remaining / 1000) + 's';
                samplingInterval = setInterval(() => {
                    remaining -= 1000;
                    if (remaining < 0) {
                        return clearInterval(samplingInterval);
                    }
                    this._elements.samplingTimeLeft.textContent = Math.floor(remaining / 1000) + 's';
                }, 1000);
            });
            connection.on('samplingUploading', () => {
                clearInterval(samplingInterval);
                this.switchView(this._views.loading);
                this._elements.loadingText.textContent = 'Uploading...';
            });
            connection.on('samplingProcessing', () => {
                clearInterval(samplingInterval);
                this.switchView(this._views.loading);
                this._elements.loadingText.textContent = 'Processing...';
            });
            connection.on('samplingFinished', () => {
                this.switchView(this._views.connected);
            });
            connection.on('samplingError', error => {
                alert(error);
            });
        }
        else {
            this.switchView(this._views.qrcode);
        }
    }
    switchView(view) {
        for (const k of Object.keys(this._views)) {
            this._views[k].style.display = 'none';
        }
        view.style.display = '';
    }
    async beforeSampling(sensorName) {
        let sensor = this._sensors.find(s => s.getProperties().name === sensorName);
        if (!sensor) {
            throw new Error('Cannot find sensor with name "' + sensorName + '"');
        }
        this._elements.samplingRecordingSensor.textContent = sensor.getProperties().name.toLowerCase();
        if (sensorName !== 'Camera') {
            this._views.sampling.style.display = 'initial';
        }
        else {
            this._views.sampling.style.display = 'none';
        }
        if (await sensor.checkPermissions(false)) {
            if (sensorName !== 'Camera') {
                this.switchView(this._views.sampling);
                this._elements.samplingRecordingStatus.textContent = 'Starting in 2 seconds';
                this._elements.samplingTimeLeft.textContent = 'Waiting...';
                await this.sleep(2000);
            }
            else {
                this.switchView(this._views.capture);
            }
            return sensor;
        }
        else {
            this.switchView(this._views.permission);
            this._elements.grantPermissionsBtn.textContent =
                'Give access to the ' + sensor.getProperties().name;
            return new Promise((resolve, reject) => {
                let permissionTimeout = setTimeout(() => {
                    reject('User did not grant permissions within one minute');
                }, 60 * 1000);
                this._elements.grantPermissionsBtn.onclick = () => {
                    if (!sensor)
                        return reject('Sensor is missing');
                    sensor.checkPermissions(true).then(async (result) => {
                        if (!sensor) {
                            return reject('Sensor is missing');
                        }
                        if (result) {
                            if (sensorName !== 'Camera') {
                                this.switchView(this._views.sampling);
                                this._elements.samplingRecordingStatus.textContent = 'Starting in 2 seconds';
                                this._elements.samplingTimeLeft.textContent = 'Waiting...';
                                await this.sleep(2000);
                            }
                            else {
                                this.switchView(this._views.capture);
                            }
                            resolve(sensor);
                        }
                        else {
                            reject('User has rejected accelerometer permissions');
                        }
                    }).catch(reject);
                    clearInterval(permissionTimeout);
                };
            });
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=collection-views.js.map